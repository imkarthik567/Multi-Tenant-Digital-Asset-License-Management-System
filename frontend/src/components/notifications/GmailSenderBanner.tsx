import React, { useEffect } from 'react';
import {
  initAuth,
  subscribeGmailAuthChange,
  getCachedGmailToken,
} from '../../services/gmailAuth';

export interface GmailSenderBannerProps {
  compact?: boolean;
}

/**
 * Silent background synchronizer for Gmail delivery.
 * Keeps OAuth/SMTP state initialized in the background without rendering UI banner clutter.
 */
export const GmailSenderBanner: React.FC<GmailSenderBannerProps> = () => {
  useEffect(() => {
    const unsubFirebase = initAuth(() => {
      getCachedGmailToken();
    });
    const unsubLocal = subscribeGmailAuthChange(() => {
      getCachedGmailToken();
    });
    return () => {
      unsubFirebase();
      unsubLocal();
    };
  }, []);

  return null;
};
