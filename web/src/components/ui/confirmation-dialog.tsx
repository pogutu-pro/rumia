'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils/cn';

export type DialogVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isConfirming?: boolean;
  variant?: DialogVariant;
}

const variantConfig: Record<
  DialogVariant,
  {
    icon: React.ReactNode;
    iconClass: string;
    confirmVariant: 'destructive' | 'default';
  }
> = {
  danger: {
    icon: <AlertTriangle className="h-6 w-6" />,
    iconClass: 'text-destructive',
    confirmVariant: 'destructive',
  },
  warning: {
    icon: <AlertTriangle className="h-6 w-6" />,
    iconClass: 'text-orange-500 dark:text-orange-400',
    confirmVariant: 'default',
  },
  info: {
    icon: <Info className="h-6 w-6" />,
    iconClass: 'text-primary',
    confirmVariant: 'default',
  },
  success: {
    icon: <CheckCircle className="h-6 w-6" />,
    iconClass: 'text-green-600 dark:text-green-400',
    confirmVariant: 'default',
  },
};

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isConfirming = false,
  variant = 'warning',
}: ConfirmationDialogProps) {
  const { icon, iconClass, confirmVariant } = variantConfig[variant];

  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Modal open={isOpen} onOpenChange={onClose}>
      <ModalContent className="sm:max-w-md">
        <ModalHeader>
          <div className="flex items-start gap-4">
            <div
              className={cn('shrink-0 pt-0.5', iconClass)}
              aria-hidden="true"
            >
              {icon}
            </div>
            <div className="flex-1">
              <ModalTitle className="text-xl font-semibold">{title}</ModalTitle>
              <ModalDescription className="mt-2 text-muted-foreground">
                {description}
              </ModalDescription>
            </div>
          </div>
        </ModalHeader>

        <ModalFooter className="gap-3 mt-6">
          <Button variant="outline" onClick={onClose} disabled={isConfirming}>
            {cancelText}
          </Button>
          <Button
            variant={
              confirmVariant === 'destructive' ? 'destructive' : 'default'
            }
            onClick={handleConfirm}
            disabled={isConfirming}
          >
            {confirmText}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
