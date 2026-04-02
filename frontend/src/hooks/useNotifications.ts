import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { apiClient } from '@/services/api';

const POLL_INTERVAL = 15_000; // 15 seconds

interface NotificationState {
  unreadMessages: number;
  permission: NotificationPermission;
  requestPermission: () => void;
}

export function useNotifications(productionId: string | undefined): NotificationState {
  const { isAuthenticated } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const lastUnread = useRef(0);
  const lastBulletinId = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  // Show a browser notification
  const showNotification = useCallback((title: string, body: string) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: `dcb-${Date.now()}`,
      });
    } catch {
      // Fallback — some browsers block Notification constructor
    }
  }, []);

  // Poll for updates
  const poll = useCallback(async () => {
    if (!productionId || !isAuthenticated) return;

    try {
      // Check unread messages
      const { count } = await apiClient<{ count: number }>(
        `/productions/${productionId}/unread-count`
      );
      if (count > lastUnread.current && lastUnread.current >= 0) {
        const newCount = count - lastUnread.current;
        if (newCount > 0 && lastUnread.current > 0) {
          showNotification(
            'New Message',
            `You have ${newCount} new message${newCount > 1 ? 's' : ''}`
          );
        }
      }
      lastUnread.current = count;
      setUnreadMessages(count);

      // Check latest bulletin post
      const posts = await apiClient<{ id: string; title: string; notify_members: boolean }[]>(
        `/productions/${productionId}/bulletin`
      );
      if (posts && posts.length > 0) {
        const latest = posts[0];
        if (lastBulletinId.current && latest.id !== lastBulletinId.current && latest.notify_members) {
          showNotification('New Announcement', latest.title);
        }
        lastBulletinId.current = latest.id;
      }
    } catch {
      // Silent — network errors shouldn't break the app
    }
  }, [productionId, isAuthenticated, showNotification]);

  useEffect(() => {
    if (!productionId || !isAuthenticated) return;

    // Initial poll
    poll();

    // Start interval
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [productionId, isAuthenticated, poll]);

  return { unreadMessages, permission, requestPermission };
}
