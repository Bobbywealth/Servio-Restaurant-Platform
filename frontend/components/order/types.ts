export interface ItemSize {
  id: string;
  sizeName: string;
  price: number;
  isPreselected: boolean;
  displayOrder: number;
}

export interface ModifierOption {
  id: string;
  name: string;
  description: string | null;
  priceDelta: number;
  isActive: boolean;
  isSoldOut: boolean;
  isPreselected: boolean;
  displayOrder: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  description: string | null;
  selectionType: 'single' | 'multiple' | 'quantity';
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  displayOrder: number;
  assignmentLevel: 'item' | 'category';
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  fromPrice?: number;
  is_available: boolean;
  category_name: string;
  category_sort_order?: number;
  images?: string[];
  image?: string;
  sizes?: ItemSize[];
  modifierGroups?: ModifierGroup[];
}

export interface RestaurantInfo {
  name: string;
  settings: any;
  logo_url?: string;
  cover_image_url?: string;
  address?: any;
  phone?: string;
  description?: string;
}

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
  quantity?: number;
}

export interface CartItem extends MenuItem {
  quantity: number;
  selectedSize?: ItemSize;
  selectedModifiers: SelectedModifier[];
  calculatedPrice: number;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  orderType: string;
  specialInstructions: string;
}

export type CheckoutStep = 'cart' | 'details' | 'payment';
