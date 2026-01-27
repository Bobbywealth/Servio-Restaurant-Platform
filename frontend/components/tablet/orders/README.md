// Extractable components from orders.tsx

// OrderQueue.tsx - Left panel order list
// OrderCard.tsx - Individual order card in queue
// OrderDetails.tsx - Middle panel with items
// CustomerInfo.tsx - Right panel customer details
// OrderActions.tsx - Action buttons based on status
// PrintPromptModal.tsx - Print confirmation modal
// ConnectionStatus.tsx - Online/Offline indicator
// OrderTimer.tsx - Time elapsed display

// Custom hooks to extract business logic:
useOrders.ts - Order fetching, filtering, sorting
useOrderActions.ts - Accept, decline, status updates
usePrinting.ts - Print functionality
useOfflineQueue.ts - Action queue management
useAudioNotifications.ts - Sound alerts
