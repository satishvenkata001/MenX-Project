import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

export class StorageService {
  /**
   * Initializes the product images storage bucket if it does not exist
   */
  static async initBucket() {
    const bucketName = env.IMAGE_BUCKET_NAME || 'menx-product-images';
    try {
      const { data: buckets, error: listErr } = await supabaseAdmin.storage.listBuckets();
      if (listErr) {
        logger.error(`Failed to list Supabase buckets: ${listErr.message}`);
        return;
      }

      const exists = buckets.some(b => b.id === bucketName);
      if (!exists) {
        logger.info(`Bucket '${bucketName}' does not exist. Creating it...`);
        const { error: createErr } = await supabaseAdmin.storage.createBucket(bucketName, {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          fileSizeLimit: env.IMAGE_MAX_SIZE_BYTES || 2097152
        });

        if (createErr) {
          logger.error(`Failed to create Supabase storage bucket '${bucketName}': ${createErr.message}`);
        } else {
          logger.info(`Successfully created public storage bucket '${bucketName}'.`);
        }
      } else {
        logger.info(`Supabase storage bucket '${bucketName}' already exists. Reusing it.`);
      }
    } catch (err) {
      logger.error('Unexpected error during storage bucket initialization', err);
    }
  }

  /**
   * Uploads a file to Supabase Storage and returns storage path and public URL
   */
  static async uploadProductImage(productId, fileBuffer, mimeType, originalName) {
    const bucketName = env.IMAGE_BUCKET_NAME || 'menx-product-images';
    
    // Extract extension safely
    const dotIndex = originalName.lastIndexOf('.');
    const ext = dotIndex !== -1 ? originalName.substring(dotIndex).toLowerCase() : '.jpg';
    
    const filename = `${crypto.randomUUID()}${ext}`;
    const storagePath = `products/${productId}/${filename}`;

    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false
      });

    if (error) {
      logger.error(`Storage upload failed for product ${productId}: ${error.message}`);
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    return {
      storagePath,
      publicUrl
    };
  }

  /**
   * Deletes a file from Supabase Storage by its relative storage path
   */
  static async deleteProductImage(storagePath) {
    const bucketName = env.IMAGE_BUCKET_NAME || 'menx-product-images';
    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .remove([storagePath]);

    if (error) {
      logger.error(`Failed to delete storage object '${storagePath}': ${error.message}`);
      throw new Error(`Storage deletion failed: ${error.message}`);
    }

    return data;
  }
}
