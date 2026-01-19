import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { motion } from 'framer-motion';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Star,
  ShoppingCart,
  Plus,
  Minus,
  DollarSign,
  Globe,
  Facebook,
  Instagram,
  Twitter,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface RestaurantData {
  id: string;
  name: string;
  description: string;
  cuisine_type: string;
  price_range: string;
  logo_url: string;
  cover_image_url: string;
  phone: string;
  email: string;
  website: string;
  address: any;
  social_links: any;
  operating_hours: any;
  online_ordering_enabled: boolean;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_fee: number;
  minimum_order: number;
  theme: {
    primary_color: string;
    secondary_color: string;
    text_color: string;
    background_color: string;
    font_family: string;
    layout_style: string;
  };
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  allergens: string[];
  preparation_time: number;
  is_available: boolean;
}

interface MenuCategory {
  category_name: string;
  items: MenuItem[];
}

interface CartItem extends MenuItem {
  quantity: number;
}

interface PublicProfileProps {
  restaurant: RestaurantData;
  menuData: { categories: MenuCategory[] };
  linkType: string;
  error?: string;
}

const PublicProfile: React.FC<PublicProfileProps> = ({ restaurant, menuData, linkType, error }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    if (menuData?.categories && menuData.categories.length > 0) {
      setSelectedCategory(menuData.categories[0].category_name);
    }
  }, [menuData]);

  const addToCart = (item: MenuItem) => {
    if (!restaurant.online_ordering_enabled) {
      toast.error('Online ordering is not available');
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
      if (existingItem) {
        return prevCart.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      } else {
        return [...prevCart, { ...item, quantity: 1 }];
      }
    });
    toast.success('Added to cart!');
  };

  const removeFromCart = (itemId: string) => {
    setCart(prevCart => {
      return prevCart.reduce((acc: CartItem[], cartItem) => {
        if (cartItem.id === itemId) {
          if (cartItem.quantity > 1) {
            acc.push({ ...cartItem, quantity: cartItem.quantity - 1 });
          }
        } else {
          acc.push(cartItem);
        }
        return acc;
      }, []);
    });
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Restaurant Not Found</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const theme = restaurant.theme || {
    primary_color: '#ff6b35',
    secondary_color: '#f7931e',
    text_color: '#333333',
    background_color: '#ffffff',
    font_family: 'Inter'
  };

  const customStyle = {
    '--primary-color': theme.primary_color,
    '--secondary-color': theme.secondary_color,
    '--text-color': theme.text_color,
    '--background-color': theme.background_color,
    fontFamily: theme.font_family,
  } as React.CSSProperties;

  return (
    <>
      <Head>
        <title>{restaurant.name} - Menu & Ordering</title>
        <meta name="description" content={restaurant.description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen" style={{...customStyle, backgroundColor: theme.background_color}}>
        {/* Header */}
        <div className="relative">
          {restaurant.cover_image_url && (
            <div className="h-48 md:h-64 bg-cover bg-center" style={{backgroundImage: `url(${restaurant.cover_image_url})`}}>
              <div className="absolute inset-0 bg-black bg-opacity-40"></div>
            </div>
          )}
          
          <div className="relative bg-white border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex items-center space-x-6">
                {restaurant.logo_url && (
                  <img
                    src={restaurant.logo_url}
                    alt={restaurant.name}
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                )}
                <div className="flex-1">
                  <h1 className="text-2xl md:text-3xl font-bold" style={{color: theme.text_color}}>
                    {restaurant.name}
                  </h1>
                  {restaurant.description && (
                    <p className="text-gray-600 mt-2">{restaurant.description}</p>
                  )}
                  <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                    {restaurant.cuisine_type && (
                      <span>{restaurant.cuisine_type}</span>
                    )}
                    {restaurant.price_range && (
                      <span>{restaurant.price_range}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact & Hours */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {restaurant.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <a href={`tel:${restaurant.phone}`} className="text-gray-600 hover:text-gray-900">
                      {restaurant.phone}
                    </a>
                  </div>
                )}
                {restaurant.address && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      {restaurant.address.street}, {restaurant.address.city}
                    </span>
                  </div>
                )}
                {restaurant.operating_hours && Object.keys(restaurant.operating_hours).length > 0 && (
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      Open Today
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation for different sections */}
        {linkType === 'menu' && (
          <div className="bg-white border-b sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <nav className="flex space-x-8 overflow-x-auto">
                {menuData?.categories?.map((category, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedCategory(category.category_name)}
                    className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                      selectedCategory === category.category_name
                        ? 'border-current text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    style={{
                      color: selectedCategory === category.category_name ? theme.primary_color : undefined
                    }}
                  >
                    {category.category_name}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {linkType === 'menu' && menuData && (
            <div className="space-y-8">
              {menuData.categories
                .filter(category => !selectedCategory || category.category_name === selectedCategory)
                .map((category, categoryIndex) => (
                <div key={categoryIndex} className="space-y-4">
                  <h2 className="text-2xl font-bold" style={{color: theme.text_color}}>
                    {category.category_name}
                  </h2>
                  <div className="grid grid-cols-1 gap-4">
                    {category.items
                      .filter(item => item.is_available)
                      .map((item, itemIndex) => (
                      <motion.div
                        key={itemIndex}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: itemIndex * 0.1 }}
                        className="bg-white rounded-lg border p-4 hover:shadow-lg transition-all"
                      >
                        <div className="flex items-start space-x-4">
                          {item.images.length > 0 && (
                            <img
                              src={item.images[0]}
                              alt={item.name}
                              className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-medium text-lg" style={{color: theme.text_color}}>
                                  {item.name}
                                </h3>
                                {item.description && (
                                  <p className="text-gray-600 mt-1 text-sm">
                                    {item.description}
                                  </p>
                                )}
                                {item.allergens.length > 0 && (
                                  <div className="flex items-center space-x-1 mt-2">
                                    <AlertTriangle className="h-3 w-3 text-orange-500" />
                                    <span className="text-xs text-orange-600">
                                      Contains: {item.allergens.join(', ')}
                                    </span>
                                  </div>
                                )}
                                {item.preparation_time > 0 && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Prep time: {item.preparation_time} min
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-semibold" style={{color: theme.primary_color}}>
                                  ${item.price.toFixed(2)}
                                </p>
                                {restaurant.online_ordering_enabled && (
                                  <button
                                    onClick={() => addToCart(item)}
                                    className="mt-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
                                    style={{backgroundColor: theme.primary_color}}
                                  >
                                    Add to Cart
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {linkType === 'contact' && (
            <div className="max-w-2xl space-y-6">
              <h2 className="text-2xl font-bold" style={{color: theme.text_color}}>
                Contact Us
              </h2>
              <div className="bg-white rounded-lg border p-6 space-y-4">
                {restaurant.phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">Phone</p>
                      <a href={`tel:${restaurant.phone}`} className="text-gray-600 hover:text-gray-900">
                        {restaurant.phone}
                      </a>
                    </div>
                  </div>
                )}
                {restaurant.email && (
                  <div className="flex items-center space-x-3">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">Email</p>
                      <a href={`mailto:${restaurant.email}`} className="text-gray-600 hover:text-gray-900">
                        {restaurant.email}
                      </a>
                    </div>
                  </div>
                )}
                {restaurant.address && (
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">Address</p>
                      <p className="text-gray-600">
                        {restaurant.address.street}<br/>
                        {restaurant.address.city}, {restaurant.address.state} {restaurant.address.zip}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {linkType === 'order' && (
            <div className="text-center py-12">
              <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2" style={{color: theme.text_color}}>
                Online Ordering
              </h2>
              {restaurant.online_ordering_enabled ? (
                <p className="text-gray-600 mb-6">
                  Browse our menu and place your order for pickup or delivery.
                </p>
              ) : (
                <div className="text-gray-600 mb-6">
                  <p>Online ordering is currently unavailable.</p>
                  <p>Please call us to place an order.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Cart Button */}
        {restaurant.online_ordering_enabled && cart.length > 0 && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="fixed bottom-6 right-6 bg-white rounded-full p-4 shadow-2xl border border-gray-200 z-50"
            onClick={() => setIsCartOpen(true)}
            style={{borderColor: theme.primary_color}}
          >
            <div className="flex items-center space-x-2">
              <ShoppingCart className="h-6 w-6" style={{color: theme.primary_color}} />
              <span className="font-medium" style={{color: theme.text_color}}>
                {getCartItemCount()} items • ${getCartTotal().toFixed(2)}
              </span>
            </div>
          </motion.button>
        )}

        {/* Cart Modal */}
        {isCartOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setIsCartOpen(false)}></div>
              
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium mb-4">Your Order</h3>
                  
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {cart.map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{item.name}</h4>
                          <p className="text-sm text-gray-600">${item.price.toFixed(2)} each</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="font-medium">{item.quantity}</span>
                          <button
                            onClick={() => addToCart(item)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                            style={{backgroundColor: theme.primary_color}}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {restaurant.delivery_enabled && getCartTotal() < restaurant.minimum_order && (
                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-700">
                        Minimum order: ${restaurant.minimum_order.toFixed(2)}
                        (Add ${(restaurant.minimum_order - getCartTotal()).toFixed(2)} more)
                      </p>
                    </div>
                  )}
                  
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total:</span>
                      <span>${getCartTotal().toFixed(2)}</span>
                    </div>
                    {restaurant.delivery_enabled && restaurant.delivery_fee > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        + ${restaurant.delivery_fee.toFixed(2)} delivery fee
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm"
                    style={{backgroundColor: theme.primary_color}}
                    disabled={restaurant.delivery_enabled && getCartTotal() < restaurant.minimum_order}
                  >
                    Checkout
                  </button>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ params, req }) => {
  const slugArray = params?.slug as string[];
  
  if (!slugArray || slugArray.length === 0) {
    return {
      notFound: true,
    };
  }

  // For this demo, we'll simulate the restaurant data
  // In production, you would fetch this from your API based on the slug
  const restaurantId = '00000000-0000-0000-0000-000000000001';
  const linkPath = slugArray[0];

  try {
    // Simulate API calls - in production, these would be real API calls to your backend
    const restaurant: RestaurantData = {
      id: restaurantId,
      name: 'Demo Restaurant',
      description: 'Authentic Caribbean cuisine with a modern twist. Fresh ingredients, bold flavors, and warm hospitality.',
      cuisine_type: 'Caribbean',
      price_range: '$$',
      logo_url: '/api/placeholder/logo.jpg',
      cover_image_url: '/api/placeholder/cover.jpg',
      phone: '+1 (555) 123-4567',
      email: 'demo@servio.com',
      website: 'https://servio.com',
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'USA'
      },
      social_links: {
        facebook: 'https://facebook.com/restaurant',
        instagram: 'https://instagram.com/restaurant'
      },
      operating_hours: {
        monday: { open: '09:00', close: '22:00' },
        tuesday: { open: '09:00', close: '22:00' }
      },
      online_ordering_enabled: true,
      delivery_enabled: true,
      pickup_enabled: true,
      delivery_fee: 2.99,
      minimum_order: 15.00,
      theme: {
        primary_color: '#ff6b35',
        secondary_color: '#f7931e',
        text_color: '#333333',
        background_color: '#ffffff',
        font_family: 'Inter',
        layout_style: 'modern'
      }
    };

    const menuData = {
      categories: [
        {
          category_name: 'Appetizers',
          items: [
            {
              id: '1',
              name: 'Jerk Chicken Wings',
              description: 'Spicy Caribbean-style chicken wings with our house jerk seasoning',
              price: 12.99,
              images: ['/api/placeholder/wings.jpg'],
              allergens: ['gluten'],
              preparation_time: 15,
              is_available: true
            }
          ]
        },
        {
          category_name: 'Main Courses',
          items: [
            {
              id: '2',
              name: 'Curry Goat',
              description: 'Traditional Caribbean curry goat served with rice and peas',
              price: 18.99,
              images: ['/api/placeholder/curry.jpg'],
              allergens: [],
              preparation_time: 25,
              is_available: true
            },
            {
              id: '3',
              name: 'Oxtail Dinner',
              description: 'Slow-cooked oxtail in rich gravy with vegetables',
              price: 22.99,
              images: ['/api/placeholder/oxtail.jpg'],
              allergens: [],
              preparation_time: 35,
              is_available: true
            }
          ]
        }
      ]
    };

    // Determine link type based on path
    let linkType = 'menu';
    if (linkPath === 'contact') linkType = 'contact';
    if (linkPath === 'order') linkType = 'order';

    return {
      props: {
        restaurant,
        menuData: linkType === 'menu' ? menuData : null,
        linkType,
      },
    };
  } catch (error) {
    return {
      props: {
        restaurant: null,
        menuData: null,
        linkType: 'menu',
        error: 'Restaurant not found or temporarily unavailable',
      },
    };
  }
};

export default PublicProfile;