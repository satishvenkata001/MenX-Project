import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Universal Modal component for MENX.
 * 
 * Guarantees standard responsive behavior across all desktop, tablet, and mobile viewports:
 * - Overlay: Fixed viewport overlay (z-[1100]) with overflow-y-auto and backdrop blur.
 * - Container: Box-sizing border-box, max-height: calc(100dvh - 32px) (fallback calc(100vh - 32px)), flex flex-col, overflow-hidden.
 * - Header: Pinned/fixed at top (flex-shrink-0), always visible and accessible.
 * - Body: Scrollable internally (flex-1 min-h-0 overflow-y-auto overflow-x-hidden).
 * - Footer: Pinned/fixed at bottom (flex-shrink-0), action buttons always reachable.
 * - Keyboard: Escape key to close.
 * - Click outside: Back-drop dismiss support.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  icon,
  iconClassName = 'text-menx-primary',
  headerAction,
  customHeader,
  maxWidth = 'max-w-2xl',
  children,
  footer,
  formProps,
  bodyClassName = 'p-4 sm:p-6 space-y-4',
  containerClassName = '',
  overlayClassName = '',
  closeDisabled = false,
  closeTitle = 'Close Modal',
  closeOnBackdrop = true,
  ariaLabelledBy,
  ariaDescribedBy,
}) {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !closeDisabled && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDisabled, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && !closeDisabled && onClose && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-sm overflow-y-auto overflow-x-hidden box-border ${overlayClassName}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
    >
      <div
        className={`relative w-full ${maxWidth} max-h-[calc(100dvh-32px)] sm:max-h-[calc(100vh-32px)] menx-card-elevated rounded-2xl shadow-2xl flex flex-col overflow-hidden my-auto ${containerClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header (Fixed, non-shrinking) */}
        {customHeader ? (
          customHeader
        ) : title ? (
          <div className="flex-shrink-0 flex justify-between items-center px-5 sm:px-6 py-4 border-b border-menx-border bg-menx-surface-elevated/95 z-10">
            <div className="flex items-center space-x-2.5 min-w-0 pr-2">
              {icon && (
                <div className={`flex-shrink-0 ${iconClassName}`}>
                  {React.isValidElement(icon)
                    ? icon
                    : typeof icon === 'function' || (typeof icon === 'object' && icon !== null)
                    ? React.createElement(icon, { className: 'w-5 h-5' })
                    : icon}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {typeof title === 'string' ? (
                    <h3 className="text-base sm:text-lg font-bold text-menx-text truncate">{title}</h3>
                  ) : (
                    <div className="text-base sm:text-lg font-bold text-white flex flex-wrap items-center gap-2">
                      {title}
                    </div>
                  )}
                  {badge}
                </div>
                {subtitle && (
                  <p className="text-xs text-menx-text-secondary font-normal mt-0.5 truncate">{subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              {headerAction}
              <button
                type="button"
                disabled={closeDisabled}
                onClick={onClose}
                className="p-1.5 rounded-lg border border-menx-border text-menx-text-secondary hover:text-menx-text hover:bg-menx-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={closeTitle}
                aria-label={closeTitle}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Modal Content & Optional Pinned Footer */}
        {formProps ? (
          <form
            {...formProps}
            className={`flex flex-col flex-1 min-h-0 overflow-hidden ${formProps.className || ''}`}
          >
            <div
              className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-admin-modal-scroll ${bodyClassName}`}
            >
              {children}
            </div>

            {footer && (
              <div className="flex-shrink-0 flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-menx-border bg-menx-surface-elevated/95 z-10">
                {footer}
              </div>
            )}
          </form>
        ) : (
          <>
            <div
              className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-admin-modal-scroll ${bodyClassName}`}
            >
              {children}
            </div>

            {footer && (
              <div className="flex-shrink-0 flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-menx-border bg-menx-surface-elevated/95 z-10">
                {footer}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
