export const ROOM_NAMING_CONVENTION = 'restaurant-{id}' as const;

export const buildRestaurantRoom = (restaurantId: string): string => `restaurant-${restaurantId}`;
export const buildUserRoom = (userId: string): string => `user-${userId}`;

