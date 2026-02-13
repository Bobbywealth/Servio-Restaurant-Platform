/**
 * useMenuCollaboration Hook
 * Client-side hook for real-time menu collaboration features
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { socketManager } from '../lib/socket';

export interface CollaboratorInfo {
  userId: string;
  userName: string;
  timestamp: Date;
}

export interface EditSessionInfo {
  itemType: 'category' | 'item' | 'modifier';
  itemId: string;
  userId: string;
  userName: string;
  startedAt: Date;
}

export interface MenuUpdateEvent {
  type: 'create' | 'update' | 'delete' | 'reorder';
  entityType: 'category' | 'item' | 'modifier';
  entityId: string;
  restaurantId: string;
  userId: string;
  userName: string;
  data?: any;
  timestamp: Date;
}

export interface CursorUpdateEvent {
  userId: string;
  userName: string;
  field: string;
  position: number;
  timestamp: Date;
}

export interface UseMenuCollaborationOptions {
  restaurantId: string | undefined;
  userId: string | undefined;
  userName: string | undefined;
  enabled?: boolean;
  onUpdate?: (event: MenuUpdateEvent) => void;
  onUserJoin?: (user: CollaboratorInfo) => void;
  onUserLeave?: (user: CollaboratorInfo) => void;
  onEditStart?: (session: EditSessionInfo) => void;
  onEditEnd?: (session: { itemType: string; itemId: string; userId: string }) => void;
  onEditConflict?: (conflict: { itemType: string; itemId: string; editingBy: { userId: string; userName: string }; startedAt: Date }) => void;
}

export interface UseMenuCollaborationReturn {
  // Connection status
  isConnected: boolean;
  
  // Active collaborators
  onlineUsers: CollaboratorInfo[];
  activeEditSessions: EditSessionInfo[];
  
  // Actions
  startEditing: (itemType: 'category' | 'item' | 'modifier', itemId: string) => void;
  stopEditing: (itemType: 'category' | 'item' | 'modifier', itemId: string) => void;
  broadcastUpdate: (type: MenuUpdateEvent['type'], entityType: MenuUpdateEvent['entityType'], entityId: string, data?: any) => void;
  sendCursorPosition: (field: string, position: number) => void;
  
  // State
  cursorPositions: Map<string, CursorUpdateEvent>;
}

export function useMenuCollaboration(
  options: UseMenuCollaborationOptions
): UseMenuCollaborationReturn {
  const {
    restaurantId,
    userId,
    userName,
    enabled = true,
    onUpdate,
    onUserJoin,
    onUserLeave,
    onEditStart,
    onEditEnd,
    onEditConflict
  } = options;

  const [isConnected, setIsConnected] = useState(socketManager.connected);
  const [onlineUsers, setOnlineUsers] = useState<CollaboratorInfo[]>([]);
  const [activeEditSessions, setActiveEditSessions] = useState<EditSessionInfo[]>([]);
  const [cursorPositions, setCursorPositions] = useState<Map<string, CursorUpdateEvent>>(new Map());
  
  // Track current editing state
  const currentEditRef = useRef<{ itemType: string; itemId: string } | null>(null);

  // Track connection status
  useEffect(() => {
    if (!enabled) return;

    const handleConnectionChange = (status: boolean) => {
      setIsConnected(status);
    };

    const cleanup = socketManager.onConnectionChange(handleConnectionChange);
    setIsConnected(socketManager.connected);

    return cleanup;
  }, [enabled]);

  // Join/leave room when restaurant changes
  useEffect(() => {
    if (!enabled || !restaurantId || !userId || !isConnected) {
      return;
    }

    // Join the menu room
    socketManager.emit('menu:join', {
      restaurantId,
      userId,
      userName: userName || 'Unknown User'
    });

    return () => {
      // Leave the menu room
      socketManager.emit('menu:leave', {
        restaurantId,
        userId
      });
      
      // End any active edit session
      if (currentEditRef.current) {
        socketManager.emit('menu:edit:end', {
          restaurantId,
          userId,
          ...currentEditRef.current
        });
      }
    };
  }, [isConnected, restaurantId, userId, userName, enabled]);

  // Set up event listeners
  useEffect(() => {
    if (!enabled) return;

    // Handle user joined
    const handleUserJoined = (data: CollaboratorInfo) => {
      setOnlineUsers(prev => {
        const filtered = prev.filter(u => u.userId !== data.userId);
        return [...filtered, { ...data, timestamp: new Date(data.timestamp) }];
      });
      onUserJoin?.({ ...data, timestamp: new Date(data.timestamp) });
    };

    // Handle user left
    const handleUserLeft = (data: CollaboratorInfo) => {
      setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
      onUserLeave?.({ ...data, timestamp: new Date(data.timestamp) });
    };

    // Handle active edits received
    const handleActiveEdits = (sessions: EditSessionInfo[]) => {
      setActiveEditSessions(sessions.map(s => ({
        ...s,
        startedAt: new Date(s.startedAt)
      })));
    };

    // Handle edit started
    const handleEditStarted = (data: EditSessionInfo) => {
      setActiveEditSessions(prev => {
        const filtered = prev.filter(
          s => !(s.itemType === data.itemType && s.itemId === data.itemId)
        );
        return [...filtered, { ...data, startedAt: new Date(data.startedAt) }];
      });
      onEditStart?.({ ...data, startedAt: new Date(data.startedAt) });
    };

    // Handle edit ended
    const handleEditEnded = (data: { itemType: string; itemId: string; userId: string }) => {
      setActiveEditSessions(prev => 
        prev.filter(s => !(s.itemType === data.itemType && s.itemId === data.itemId))
      );
      onEditEnd?.(data);
    };

    // Handle edit conflict
    const handleEditConflict = (data: { itemType: string; itemId: string; editingBy: { userId: string; userName: string }; startedAt: Date }) => {
      onEditConflict?.({
        ...data,
        startedAt: new Date(data.startedAt)
      });
    };

    // Handle menu update
    const handleMenuUpdate = (event: MenuUpdateEvent) => {
      onUpdate?.({ ...event, timestamp: new Date(event.timestamp) });
    };

    // Handle cursor update
    const handleCursorUpdate = (data: CursorUpdateEvent) => {
      setCursorPositions(prev => {
        const next = new Map(prev);
        next.set(data.userId, { ...data, timestamp: new Date(data.timestamp) });
        return next;
      });
    };

    // Register listeners
    socketManager.on('menu:user:joined', handleUserJoined);
    socketManager.on('menu:user:left', handleUserLeft);
    socketManager.on('menu:active:edits', handleActiveEdits);
    socketManager.on('menu:edit:started', handleEditStarted);
    socketManager.on('menu:edit:ended', handleEditEnded);
    socketManager.on('menu:edit:conflict', handleEditConflict);
    socketManager.on('menu:updated', handleMenuUpdate);
    socketManager.on('menu:cursor:update', handleCursorUpdate);

    return () => {
      socketManager.off('menu:user:joined', handleUserJoined);
      socketManager.off('menu:user:left', handleUserLeft);
      socketManager.off('menu:active:edits', handleActiveEdits);
      socketManager.off('menu:edit:started', handleEditStarted);
      socketManager.off('menu:edit:ended', handleEditEnded);
      socketManager.off('menu:edit:conflict', handleEditConflict);
      socketManager.off('menu:updated', handleMenuUpdate);
      socketManager.off('menu:cursor:update', handleCursorUpdate);
    };
  }, [enabled, onUpdate, onUserJoin, onUserLeave, onEditStart, onEditEnd, onEditConflict]);

  /**
   * Start editing an item
   */
  const startEditing = useCallback((
    itemType: 'category' | 'item' | 'modifier',
    itemId: string
  ) => {
    if (!enabled || !restaurantId || !userId) return;

    currentEditRef.current = { itemType, itemId };
    
    socketManager.emit('menu:edit:start', {
      restaurantId,
      userId,
      userName: userName || 'Unknown User',
      itemType,
      itemId
    });
  }, [restaurantId, userId, userName, enabled]);

  /**
   * Stop editing an item
   */
  const stopEditing = useCallback((
    itemType: 'category' | 'item' | 'modifier',
    itemId: string
  ) => {
    if (!enabled || !restaurantId || !userId) return;

    currentEditRef.current = null;
    
    socketManager.emit('menu:edit:end', {
      restaurantId,
      userId,
      itemType,
      itemId
    });
  }, [restaurantId, userId, enabled]);

  /**
   * Broadcast a menu update
   */
  const broadcastUpdate = useCallback((
    type: MenuUpdateEvent['type'],
    entityType: MenuUpdateEvent['entityType'],
    entityId: string,
    data?: any
  ) => {
    if (!enabled || !restaurantId || !userId) return;

    socketManager.emit('menu:update', {
      type,
      entityType,
      entityId,
      restaurantId,
      userId,
      userName: userName || 'Unknown User',
      data
    });
  }, [restaurantId, userId, userName, enabled]);

  /**
   * Send cursor position for collaborative editing
   */
  const sendCursorPosition = useCallback((field: string, position: number) => {
    if (!enabled || !restaurantId || !userId) return;

    socketManager.emit('menu:cursor', {
      restaurantId,
      userId,
      userName: userName || 'Unknown User',
      field,
      position
    });
  }, [restaurantId, userId, userName, enabled]);

  /**
   * Check if an item is being edited by someone else
   */
  const getItemEditSession = useCallback((
    itemType: 'category' | 'item' | 'modifier',
    itemId: string
  ): EditSessionInfo | undefined => {
    return activeEditSessions.find(
      s => s.itemType === itemType && s.itemId === itemId
    );
  }, [activeEditSessions]);

  return {
    isConnected,
    onlineUsers,
    activeEditSessions,
    cursorPositions,
    startEditing,
    stopEditing,
    broadcastUpdate,
    sendCursorPosition
  };
}

export default useMenuCollaboration;
