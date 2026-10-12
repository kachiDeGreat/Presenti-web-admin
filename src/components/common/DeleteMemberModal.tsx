import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import type { ChurchMember } from '../../types';
import styles from './DeleteMemberModal.module.css';

interface DeleteMemberModalProps {
  isOpen: boolean;
  member: ChurchMember | null;
  churchName?: string;
  onClose: () => void;
  onConfirmDelete: (member: ChurchMember) => Promise<void>;
}

export const DeleteMemberModal: React.FC<DeleteMemberModalProps> = ({
  isOpen,
  member,
  churchName = 'the organization',
  onClose,
  onConfirmDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsDeleting(false);
    }
  }, [isOpen]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen || !member) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete(member);
      onClose();
    } catch {
      // Error is caught and surfaced via toast in parent
    } finally {
      setIsDeleting(false);
    }
  };

  const isBound = member.boundDeviceId && member.boundDeviceId !== 'UNBOUND';

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className={styles.modalCard}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.iconCircle}>
              <Trash2 size={20} />
            </div>
            <div className={styles.headerTitles}>
              <h3 id="delete-modal-title">Delete Member</h3>
              <p>Remove personnel from organization directory</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Permanent Warning */}
          <div className={styles.warningBanner}>
            <AlertTriangle size={18} className={styles.warningIcon} />
            <div className={styles.warningContent}>
              <strong>This action is irreversible and permanent.</strong>
              <p>
                This will delete <strong>{member.fullName}</strong> from {churchName} and permanently erase their profile and credentials from the Firestore database.
              </p>
            </div>
          </div>

          {/* Member Card Preview */}
          <div className={styles.memberCard}>
            <div className={styles.memberTopRow}>
              {member.photoURL ? (
                <img
                  src={member.photoURL}
                  alt={member.fullName}
                  className={styles.avatar}
                />
              ) : (
                <div className={styles.avatarFallback}>
                  {(member.fullName?.[0] || 'U').toUpperCase()}
                </div>
              )}
              <div className={styles.memberInfo}>
                <div className={styles.memberName}>{member.fullName}</div>
                <div className={styles.memberEmail}>
                  {member.email || 'No email attached'}
                </div>
              </div>
            </div>

            <div className={styles.memberDetailsGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Department</span>
                <span className={styles.detailValue}>{member.department}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Phone Number</span>
                <span className={styles.detailValue}>{member.phone}</span>
              </div>
              <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                <span className={styles.detailLabel}>Hardware Device Lock</span>
                <span className={styles.detailMono}>
                  {isBound ? member.boundDeviceId : 'Unpinned (No hardware bound)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnDanger}
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Deleting from Database...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Delete from Organization</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
