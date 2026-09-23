import { pool } from '../config/db.js';

async function updateStoredProc() {
  const query = `
    CREATE OR REPLACE FUNCTION public.process_cod_checkout_atomic(
      p_user_id UUID,
      p_address_id UUID,
      p_coupon_code VARCHAR DEFAULT NULL,
      p_customer_notes TEXT DEFAULT NULL
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
      DECLARE
        v_cart_id UUID;
        v_cart_item_count INT;
        v_subtotal_amount NUMERIC(10, 2) := 0.00;
        v_delivery_fee NUMERIC(10, 2) := 0.00;
        v_discount_amount NUMERIC(10, 2) := 0.00;
        v_total_payable NUMERIC(10, 2) := 0.00;
        v_delivery_zone_id UUID;
        v_base_delivery_charge NUMERIC(10, 2) := 0.00;
        v_free_delivery_threshold NUMERIC(10, 2) := NULL;
        v_order_id UUID;
        v_order_number VARCHAR;
        v_shipping_snapshot JSONB;
        r_address RECORD;
        r_coupon RECORD;
        r_item RECORD;
        v_user_redemptions_count INT;
        v_item_subtotal NUMERIC(10, 2);
        v_item_discount NUMERIC(10, 2);
        v_item_total NUMERIC(10, 2);
        v_remaining_discount NUMERIC(10, 2);
        v_item_index INT := 0;
      BEGIN
        -- 1. Validate User
        IF p_user_id IS NULL THEN
          RAISE EXCEPTION 'User ID is required';
        END IF;

        -- 2. Validate and Lock Customer Cart
        SELECT id INTO v_cart_id
        FROM carts
        WHERE user_id = p_user_id
        FOR UPDATE;

        IF v_cart_id IS NULL THEN
          RAISE EXCEPTION 'Active cart not found for user';
        END IF;

        SELECT COUNT(*) INTO v_cart_item_count
        FROM cart_items
        WHERE cart_id = v_cart_id;

        IF v_cart_item_count = 0 THEN
          RAISE EXCEPTION 'Cart is empty';
        END IF;

        -- 3. Validate Shipping Address
        SELECT 
          id,
          recipient_name,
          phone_number,
          alternate_phone,
          address_line1,
          address_line2,
          landmark,
          city,
          state,
          postal_code,
          address_type
        INTO r_address
        FROM addresses
        WHERE id = p_address_id AND user_id = p_user_id;

        IF r_address.id IS NULL THEN
          RAISE EXCEPTION 'Invalid or unauthorized shipping address';
        END IF;

        -- 4. Determine Delivery Zone
        SELECT id, base_delivery_charge, free_delivery_threshold
        INTO v_delivery_zone_id, v_base_delivery_charge, v_free_delivery_threshold
        FROM delivery_zones
        WHERE is_active = TRUE
          AND r_address.postal_code LIKE REPLACE(pincode_pattern, '*', '%')
        ORDER BY LENGTH(REPLACE(pincode_pattern, '*', '')) DESC
        LIMIT 1;

        IF v_delivery_zone_id IS NULL THEN
          RAISE EXCEPTION 'No shipping service available for pincode %', r_address.postal_code;
        END IF;

        -- 5. Calculate Subtotal from Current Variant Selling Prices
        SELECT COALESCE(SUM(v.selling_price * ci.quantity), 0.00)
        INTO v_subtotal_amount
        FROM cart_items ci
        JOIN product_variants v ON v.id = ci.variant_id
        WHERE ci.cart_id = v_cart_id;

        -- 6. Validate Catalog Status (Must be active and published)
        IF EXISTS (
          SELECT 1
          FROM cart_items ci
          JOIN product_variants v ON v.id = ci.variant_id
          JOIN products p ON p.id = v.product_id
          WHERE ci.cart_id = v_cart_id
            AND (v.is_active = FALSE OR p.status != 'PUBLISHED')
        ) THEN
          RAISE EXCEPTION 'One or more items in the cart are no longer available for purchase';
        END IF;

        -- 7. Validate Coupon (if supplied)
        IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
          SELECT * INTO r_coupon
          FROM coupons
          WHERE code = UPPER(TRIM(p_coupon_code))
            AND is_active = TRUE;

          IF r_coupon.id IS NULL THEN
            RAISE EXCEPTION 'Coupon is invalid or inactive';
          END IF;

          IF NOW() < r_coupon.start_date OR (r_coupon.end_date IS NOT NULL AND NOW() > r_coupon.end_date) THEN
            RAISE EXCEPTION 'Coupon validity period has expired';
          END IF;

          IF v_subtotal_amount < r_coupon.min_order_amount THEN
            RAISE EXCEPTION 'Order subtotal does not meet the minimum requirement of % for this coupon', r_coupon.min_order_amount;
          END IF;

          IF r_coupon.total_usage_limit IS NOT NULL AND r_coupon.used_count >= r_coupon.total_usage_limit THEN
            RAISE EXCEPTION 'Coupon total usage limit has been reached';
          END IF;

          SELECT COUNT(*) INTO v_user_redemptions_count
          FROM coupon_redemptions
          WHERE coupon_id = r_coupon.id AND user_id = p_user_id;

          IF v_user_redemptions_count >= r_coupon.usage_limit_per_user THEN
            RAISE EXCEPTION 'Coupon redemption limit per user exceeded';
          END IF;

          IF r_coupon.discount_type = 'PERCENTAGE' THEN
            v_discount_amount := v_subtotal_amount * (r_coupon.discount_value / 100.0);
            IF r_coupon.max_discount_amount IS NOT NULL THEN
              v_discount_amount := LEAST(v_discount_amount, r_coupon.max_discount_amount);
            END IF;
          ELSIF r_coupon.discount_type = 'FLAT_AMOUNT' THEN
            v_discount_amount := LEAST(r_coupon.discount_value, v_subtotal_amount);
          END IF;
          v_discount_amount := ROUND(v_discount_amount, 2);
        END IF;

        -- 8. Determine Delivery Fee
        IF v_free_delivery_threshold IS NOT NULL AND v_subtotal_amount >= v_free_delivery_threshold THEN
          v_delivery_fee := 0.00;
        ELSE
          v_delivery_fee := v_base_delivery_charge;
        END IF;

        -- 9. Determine Final Payable
        v_total_payable := v_subtotal_amount - v_discount_amount + v_delivery_fee;

        -- 10. Lock Required Inventory Rows in sorted variant order
        PERFORM 1
        FROM inventory_items
        WHERE variant_id IN (SELECT variant_id FROM cart_items WHERE cart_id = v_cart_id)
        ORDER BY variant_id ASC
        FOR UPDATE;

        -- 11. Create the COD Order
        v_order_id := gen_random_uuid();
        v_order_number := 'MX-' || (EXTRACT(EPOCH FROM CLOCK_TIMESTAMP()) * 1000)::bigint || '-' || floor(random() * 9000 + 1000)::integer;
        
        v_shipping_snapshot := jsonb_build_object(
          'recipient_name', r_address.recipient_name,
          'phone_number', r_address.phone_number,
          'alternate_phone', r_address.alternate_phone,
          'address_line1', r_address.address_line1,
          'address_line2', r_address.address_line2,
          'landmark', r_address.landmark,
          'city', r_address.city,
          'state', r_address.state,
          'postal_code', r_address.postal_code,
          'address_type', r_address.address_type
        );

        INSERT INTO orders (
          id,
          order_number,
          customer_id,
          order_channel,
          delivery_zone_id,
          order_status,
          payment_method,
          payment_status,
          subtotal_amount,
          discount_amount,
          delivery_fee,
          total_payable,
          cod_amount_due,
          shipping_address_id,
          shipping_snapshot,
          customer_phone,
          customer_notes
        ) VALUES (
          v_order_id,
          v_order_number,
          p_user_id,
          'ONLINE',
          v_delivery_zone_id,
          'PENDING',
          'COD',
          'PENDING',
          v_subtotal_amount,
          v_discount_amount,
          v_delivery_fee,
          v_total_payable,
          v_total_payable,
          p_address_id,
          v_shipping_snapshot,
          r_address.phone_number,
          p_customer_notes
        );

        -- 12. Create Order Items & Reserve Inventory
        v_remaining_discount := v_discount_amount;
        v_item_index := 0;

        FOR r_item IN (SELECT ci.variant_id, ci.outfit_id, ci.quantity, v.mrp, v.selling_price, p.title, v.sku, sz.name as size_name, cl.name as color_name
                       FROM cart_items ci
                       JOIN product_variants v ON v.id = ci.variant_id
                       JOIN products p ON p.id = v.product_id
                       JOIN sizes sz ON sz.id = v.size_id
                       JOIN colors cl ON cl.id = v.color_id
                       WHERE ci.cart_id = v_cart_id)
        LOOP
          v_item_index := v_item_index + 1;
          v_item_subtotal := r_item.selling_price * r_item.quantity;

          IF v_item_index = v_cart_item_count THEN
            v_item_discount := v_remaining_discount;
          ELSE
            v_item_discount := ROUND((v_item_subtotal / v_subtotal_amount) * v_discount_amount, 2);
            v_remaining_discount := v_remaining_discount - v_item_discount;
          END IF;

          v_item_total := v_item_subtotal - v_item_discount;

          INSERT INTO order_items (
            order_id,
            variant_id,
            outfit_id,
            product_title_snapshot,
            variant_sku_snapshot,
            size_snapshot,
            color_snapshot,
            unit_mrp_snapshot,
            unit_price_snapshot,
            quantity,
            line_subtotal,
            line_discount,
            line_total
          ) VALUES (
            v_order_id,
            r_item.variant_id,
            r_item.outfit_id,
            r_item.title,
            r_item.sku,
            r_item.size_name,
            r_item.color_name,
            r_item.mrp,
            r_item.selling_price,
            r_item.quantity,
            v_item_subtotal,
            v_item_discount,
            v_item_total
          );

          -- Reserve stock without store_id
          PERFORM public.reserve_inventory_for_order(
            r_item.variant_id,
            r_item.quantity,
            v_order_id,
            p_user_id
          );
        END LOOP;

        -- 13. Create Order Status History Log
        INSERT INTO order_status_history (
          order_id,
          from_status,
          to_status,
          changed_by,
          note
        ) VALUES (
          v_order_id,
          NULL,
          'PENDING',
          p_user_id,
          'Order placed via atomic checkout'
        );

        -- 14. Create Coupon Redemption Record
        IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
          INSERT INTO coupon_redemptions (
            coupon_id,
            user_id,
            order_id,
            discount_applied
          ) VALUES (
            r_coupon.id,
            p_user_id,
            v_order_id,
            v_discount_amount
          );

          UPDATE coupons
          SET used_count = used_count + 1,
              updated_at = NOW()
          WHERE id = r_coupon.id;
        END IF;

        -- 15. Clear Customer Cart
        DELETE FROM cart_items WHERE cart_id = v_cart_id;

        -- 16. Return structured JSON payload
        RETURN jsonb_build_object(
          'success', TRUE,
          'order_id', v_order_id,
          'order_number', v_order_number,
          'subtotal', v_subtotal_amount,
          'discount', v_discount_amount,
          'delivery_fee', v_delivery_fee,
          'total', v_total_payable
        );
      END;
    $$;
  `;

  await pool.query(query);
  console.log('process_cod_checkout_atomic stored procedure updated successfully.');
  process.exit(0);
}

updateStoredProc().catch(err => {
  console.error('Failed to update stored procedure:', err);
  process.exit(1);
});
