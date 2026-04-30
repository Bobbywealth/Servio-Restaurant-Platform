/**
 * Mirror of backend room naming rules (src/constants/realtimeRooms.ts).
 * Keep this file in sync with backend to avoid client/server room mismatches.
 */
export const ROOM_NAMING_CONVENTION = 'restaurant-{id}' as const

export const buildRestaurantRoom = (restaurantId: string): string => `restaurant-${restaurantId}`
export const buildUserRoom = (userId: string): string => `user-${userId}`

