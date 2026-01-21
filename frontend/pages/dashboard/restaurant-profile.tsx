import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save,
  Upload,
  Link as LinkIcon,
  Palette,
  Globe,
  Phone,
  Mail,
  MapPin,
  Clock,
  QrCode,
  Copy,
  ExternalLink,
  Plus,
  Edit3,
  Trash2,
  Eye,
  Settings,
  Image as ImageIcon,
  Share2
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { useUser } from '../../contexts/UserContext';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';

interface RestaurantProfile {
  id: string;
  name: string;
  slug: string;
  address: any;
  phone: string;
  email: string;
  website: string;
  description: string;
  cuisine_type: string;
  price_range: string;
  logo_url: string;
  cover_image_url: string;
  custom_domain: string;
  social_links: any;
  menu_pdf_url: string;
  online_ordering_enabled: boolean;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_radius: number;
  delivery_fee: number;
  minimum_order: number;
  operating_hours: any;
  timezone: string;
  settings: any;
  is_active: boolean;
}

interface RestaurantTheme {
  id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  background_color: string;
  font_family: string;
  layout_style: string;
  custom_css: string;
  is_active: boolean;
}

interface RestaurantLink {
  id: string;
  name: string;
  description: string;
  url_path: string;
  target_url: string;
  link_type: string;
  is_active: boolean;
  click_count: number;
  qr_code_url: string;
  custom_styling: any;
  created_at: string;
}

const ColorPicker = ({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      {label}
    </label>
    <div className="flex items-center space-x-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
        placeholder="#ffffff"
      />
    </div>
  </div>
);

const LinkCard = ({ link, onEdit, onDelete, onToggle }: {
  link: RestaurantLink;
  onEdit: (link: RestaurantLink) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copied to clipboard!');
  };

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://servio.com';
  const fullUrl = `${baseUrl}/r/${link.url_path}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">{link.name}</h3>
            {!link.is_active && (
              <span className="text-xs text-red-600 bg-red-100 dark:bg-red-900 px-2 py-1 rounded-full">
                Inactive
              </span>
            )}
          </div>
          {link.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {link.description}
            </p>
          )}
          <div className="mt-3 space-y-2">
            <div className="flex items-center space-x-2">
              <LinkIcon className="h-3 w-3 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                /{link.url_path}
              </span>
              <button
                onClick={() => copyToClipboard(fullUrl)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
                title="Copy full URL"
              >
                <Copy className="h-3 w-3" />
              </button>
              <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded"
                title="Open link"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>{link.click_count} clicks</span>
              <span>{link.link_type}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {link.qr_code_url && (
            <button
              onClick={() => window.open(link.qr_code_url, '_blank')}
              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              title="View QR Code"
            >
              <QrCode className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onToggle(link.id, !link.is_active)}
            className={`p-2 rounded-lg transition-colors ${
              link.is_active
                ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => onEdit(link)}
            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(link.id)}
            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const LinkForm = ({ link, onSave, onCancel }: {
  link?: RestaurantLink;
  onSave: (data: any) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({
    name: link?.name || '',
    description: link?.description || '',
    urlPath: link?.url_path || '',
    targetUrl: link?.target_url || '',
    linkType: link?.link_type || 'custom'
  });

  const linkTypes = [
    { value: 'menu', label: 'Menu' },
    { value: 'order', label: 'Order Online' },
    { value: 'contact', label: 'Contact' },
    { value: 'custom', label: 'Custom' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.urlPath.trim()) {
      toast.error('Name and URL path are required');
      return;
    }
    onSave(formData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            {link ? 'Edit Link' : 'Create Link'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Link Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="e.g., View Menu, Order Now"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Brief description of this link"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                URL Path * (will be: /r/your-restaurant/{formData.urlPath})
              </label>
              <input
                type="text"
                value={formData.urlPath}
                onChange={(e) => setFormData({ ...formData, urlPath: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="e.g., menu, order, contact"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Link Type
              </label>
              <select
                value={formData.linkType}
                onChange={(e) => setFormData({ ...formData, linkType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {linkTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {formData.linkType === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target URL (optional)
                </label>
                <input
                  type="url"
                  value={formData.targetUrl}
                  onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="https://external-site.com"
                />
              </div>
            )}

            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{link ? 'Update' : 'Create'} Link</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default function RestaurantProfile() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [theme, setTheme] = useState<RestaurantTheme | null>(null);
  const [links, setLinks] = useState<RestaurantLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editingLink, setEditingLink] = useState<RestaurantLink | null>(null);

  // Profile form state
  const [profileData, setProfileData] = useState({
    name: '',
    slug: '',
    description: '',
    cuisineType: '',
    priceRange: '',
    phone: '',
    email: '',
    website: '',
    address: {},
    socialLinks: {},
    operatingHours: {},
    onlineOrderingEnabled: false,
    deliveryEnabled: false,
    pickupEnabled: true,
    deliveryRadius: 0,
    deliveryFee: 0,
    minimumOrder: 0
  });

  // Theme form state
  const [themeData, setThemeData] = useState({
    name: 'Custom Theme',
    primaryColor: '#ff6b35',
    secondaryColor: '#f7931e',
    textColor: '#333333',
    backgroundColor: '#ffffff',
    fontFamily: 'Inter',
    layoutStyle: 'modern'
  });

  const { getRootProps: getLogoProps, getInputProps: getLogoInputProps } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    onDrop: (files) => handleImageUpload(files, 'logo')
  });

  const { getRootProps: getCoverProps, getInputProps: getCoverInputProps } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    onDrop: (files) => handleImageUpload(files, 'cover')
  });

  const fetchProfile = useCallback(async () => {
    try {
      const response = await api.get('/api/restaurant/profile');
      const data = response.data;
      if (data?.success) {
        setProfile(data.data);
        setProfileData({
          name: data.data.name || '',
          slug: data.data.slug || '',
          description: data.data.description || '',
          cuisineType: data.data.cuisine_type || '',
          priceRange: data.data.price_range || '',
          phone: data.data.phone || '',
          email: data.data.email || '',
          website: data.data.website || '',
          address: data.data.address || {},
          socialLinks: data.data.social_links || {},
          operatingHours: data.data.operating_hours || {},
          onlineOrderingEnabled: data.data.online_ordering_enabled || false,
          deliveryEnabled: data.data.delivery_enabled || false,
          pickupEnabled: data.data.pickup_enabled || true,
          deliveryRadius: data.data.delivery_radius || 0,
          deliveryFee: data.data.delivery_fee || 0,
          minimumOrder: data.data.minimum_order || 0
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load restaurant profile');
    }
  }, []);

  const fetchTheme = useCallback(async () => {
    try {
      const response = await api.get('/api/restaurant/theme');
      const data = response.data;
      if (data?.success) {
        setTheme(data.data);
        setThemeData({
          name: data.data.name || 'Custom Theme',
          primaryColor: data.data.primary_color || '#ff6b35',
          secondaryColor: data.data.secondary_color || '#f7931e',
          textColor: data.data.text_color || '#333333',
          backgroundColor: data.data.background_color || '#ffffff',
          fontFamily: data.data.font_family || 'Inter',
          layoutStyle: data.data.layout_style || 'modern'
        });
      }
    } catch (error) {
      console.error('Error fetching theme:', error);
    }
  }, []);

  const fetchLinks = useCallback(async () => {
    try {
      const response = await api.get('/api/restaurant/links');
      const data = response.data;
      if (data?.success) {
        setLinks(data.data);
      }
    } catch (error) {
      console.error('Error fetching links:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchTheme(), fetchLinks()]);
      setLoading(false);
    };
    loadData();
  }, [fetchProfile, fetchTheme, fetchLinks]);

  const handleImageUpload = async (files: File[], type: 'logo' | 'cover') => {
    if (files.length === 0) return;

    const formData = new FormData();
    formData.append(type === 'logo' ? 'logo' : 'coverImage', files[0]);

    try {
      const response = await api.put('/api/restaurant/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = response.data;
      if (data?.success) {
        toast.success(`${type === 'logo' ? 'Logo' : 'Cover image'} updated successfully`);
        await fetchProfile();
      } else {
        toast.error(data.error?.message || `Failed to update ${type}`);
      }
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      toast.error(`Failed to update ${type}`);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const response = await api.put('/api/restaurant/profile', profileData);
      const data = response.data;
      if (data?.success) {
        toast.success('Profile updated successfully');
        await fetchProfile();
      } else {
        toast.error(data.error?.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTheme = async () => {
    setSaving(true);
    try {
      const response = await api.put('/api/restaurant/theme', themeData);
      const data = response.data;
      if (data?.success) {
        toast.success('Theme updated successfully');
        await fetchTheme();
      } else {
        toast.error(data.error?.message || 'Failed to update theme');
      }
    } catch (error) {
      console.error('Error updating theme:', error);
      toast.error('Failed to update theme');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLink = async (linkData: any) => {
    try {
      const url = editingLink ? `/api/restaurant/links/${editingLink.id}` : '/api/restaurant/links';
      const method = editingLink ? 'PUT' : 'POST';
      const response = await api.request({ url, method, data: linkData });
      const data = response.data;
      if (data?.success) {
        toast.success(editingLink ? 'Link updated' : 'Link created');
        await fetchLinks();
        setShowLinkForm(false);
        setEditingLink(null);
      } else {
        toast.error(data.error?.message || 'Failed to save link');
      }
    } catch (error) {
      console.error('Error saving link:', error);
      toast.error('Failed to save link');
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm('Are you sure you want to delete this link?')) return;

    try {
      const response = await api.delete(`/api/restaurant/links/${id}`);
      const data = response.data;
      if (data?.success) {
        toast.success('Link deleted successfully');
        await fetchLinks();
      } else {
        toast.error(data.error?.message || 'Failed to delete link');
      }
    } catch (error) {
      console.error('Error deleting link:', error);
      toast.error('Failed to delete link');
    }
  };

  const handleToggleLink = async (id: string, active: boolean) => {
    try {
      const response = await api.put(`/api/restaurant/links/${id}`, { isActive: active });
      const data = response.data;
      if (data?.success) {
        toast.success(active ? 'Link activated' : 'Link deactivated');
        await fetchLinks();
      } else {
        toast.error(data.error?.message || 'Failed to update link');
      }
    } catch (error) {
      console.error('Error toggling link:', error);
      toast.error('Failed to update link');
    }
  };

  const tabs = [
    { id: 'profile', name: 'Profile', icon: Settings },
    { id: 'branding', name: 'Branding', icon: Palette },
    { id: 'links', name: 'Links & QR', icon: LinkIcon },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <Head>
        <title>Restaurant Profile - Servio</title>
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Restaurant Profile
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {"Manage your restaurant's public profile and branding"}
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                  Basic Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Restaurant Name *
                    </label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Your Restaurant Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Public Ordering Slug
                    </label>
                    <input
                      type="text"
                      value={(profileData as any).slug || ''}
                      onChange={(e) => setProfileData({ ...(profileData as any), slug: e.target.value } as any)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono"
                      placeholder="e.g., sausage-kitchen"
                    />
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Customer ordering link:
                      <span className="ml-2 font-mono text-gray-700 dark:text-gray-200">
                        {typeof window !== 'undefined' && (profileData as any).slug
                          ? `${window.location.origin}/r/${(profileData as any).slug}`
                          : `/r/${(profileData as any).slug || 'your-slug'}`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cuisine Type
                    </label>
                    <input
                      type="text"
                      value={profileData.cuisineType}
                      onChange={(e) => setProfileData({ ...profileData, cuisineType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="e.g., Italian, Caribbean, American"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Price Range
                    </label>
                    <select
                      value={profileData.priceRange}
                      onChange={(e) => setProfileData({ ...profileData, priceRange: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Select price range</option>
                      <option value="$">$ - Budget friendly</option>
                      <option value="$$">$$ - Moderate</option>
                      <option value="$$$">$$$ - Upscale</option>
                      <option value="$$$$">$$$$ - Fine dining</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={profileData.description}
                    onChange={(e) => setProfileData({ ...profileData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Tell customers about your restaurant..."
                    rows={4}
                  />
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center space-x-2 bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? 'Saving...' : 'Save Profile'}</span>
                  </button>
                </div>
              </div>

              {/* Logo and Cover Images */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                  Images
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Restaurant Logo
                    </label>
                    <div
                      {...getLogoProps()}
                      className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                    >
                      <input {...getLogoInputProps()} />
                      {profile?.logo_url ? (
                        <img
                          src={profile.logo_url}
                          alt="Restaurant logo"
                          className="w-24 h-24 object-cover rounded-lg mx-auto mb-3"
                        />
                      ) : (
                        <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      )}
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Click or drag to upload logo
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Cover Image
                    </label>
                    <div
                      {...getCoverProps()}
                      className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                    >
                      <input {...getCoverInputProps()} />
                      {profile?.cover_image_url ? (
                        <img
                          src={profile.cover_image_url}
                          alt="Restaurant cover"
                          className="w-full h-32 object-cover rounded-lg mb-3"
                        />
                      ) : (
                        <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      )}
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Click or drag to upload cover image
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                  Theme Customization
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ColorPicker
                    label="Primary Color"
                    value={themeData.primaryColor}
                    onChange={(color) => setThemeData({ ...themeData, primaryColor: color })}
                  />
                  <ColorPicker
                    label="Secondary Color"
                    value={themeData.secondaryColor}
                    onChange={(color) => setThemeData({ ...themeData, secondaryColor: color })}
                  />
                  <ColorPicker
                    label="Text Color"
                    value={themeData.textColor}
                    onChange={(color) => setThemeData({ ...themeData, textColor: color })}
                  />
                  <ColorPicker
                    label="Background Color"
                    value={themeData.backgroundColor}
                    onChange={(color) => setThemeData({ ...themeData, backgroundColor: color })}
                  />
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Font Family
                    </label>
                    <select
                      value={themeData.fontFamily}
                      onChange={(e) => setThemeData({ ...themeData, fontFamily: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="Inter">Inter</option>
                      <option value="Poppins">Poppins</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Open Sans">Open Sans</option>
                      <option value="Montserrat">Montserrat</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Layout Style
                    </label>
                    <select
                      value={themeData.layoutStyle}
                      onChange={(e) => setThemeData({ ...themeData, layoutStyle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="modern">Modern</option>
                      <option value="classic">Classic</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Theme Preview
                  </h3>
                  <div
                    className="p-6 rounded-lg border"
                    style={{
                      backgroundColor: themeData.backgroundColor,
                      color: themeData.textColor,
                      fontFamily: themeData.fontFamily
                    }}
                  >
                    <h4
                      className="text-xl font-bold mb-2"
                      style={{ color: themeData.primaryColor }}
                    >
                      {profile?.name || 'Your Restaurant'}
                    </h4>
                    <p className="mb-4">
                      {profile?.description || 'This is how your restaurant profile will look with the selected theme.'}
                    </p>
                    <button
                      className="px-4 py-2 rounded-lg text-white font-medium"
                      style={{ backgroundColor: themeData.primaryColor }}
                    >
                      Order Now
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleSaveTheme}
                    disabled={saving}
                    className="flex items-center space-x-2 bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
                  >
                    <Palette className="h-4 w-4" />
                    <span>{saving ? 'Saving...' : 'Save Theme'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Links Tab */}
          {activeTab === 'links' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Restaurant Links & QR Codes
                </h2>
                <button
                  onClick={() => setShowLinkForm(true)}
                  className="flex items-center space-x-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Link</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {links.map((link) => (
                  <LinkCard
                    key={link.id}
                    link={link}
                    onEdit={(link) => {
                      setEditingLink(link);
                      setShowLinkForm(true);
                    }}
                    onDelete={handleDeleteLink}
                    onToggle={handleToggleLink}
                  />
                ))}
              </div>

              {links.length === 0 && (
                <div className="text-center py-12">
                  <LinkIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No links created yet. Create your first link to share with customers!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Link Form Modal */}
          <AnimatePresence>
            {showLinkForm && (
              <LinkForm
                link={editingLink || undefined}
                onSave={handleSaveLink}
                onCancel={() => {
                  setShowLinkForm(false);
                  setEditingLink(null);
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </>
  );
}