import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Mail,
  MessageSquare,
  Plus,
  Send,
  Calendar,
  Target,
  TrendingUp,
  Filter,
  Search,
  Edit3,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  PieChart,
  Phone,
  AtSign,
  Tag,
  Download,
  Upload,
  Settings
} from 'lucide-react';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { useUser } from '../../contexts/UserContext';
import toast from 'react-hot-toast';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  preferences: any;
  tags: string[];
  total_orders: number;
  total_spent: number;
  last_order_date: string;
  opt_in_sms: boolean;
  opt_in_email: boolean;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  type: 'sms' | 'email';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  message: string;
  subject?: string;
  target_criteria: any;
  scheduled_at: string;
  sent_at?: string;
  total_recipients: number;
  successful_sends: number;
  failed_sends: number;
  created_at: string;
}

interface MarketingAnalytics {
  timeframe: string;
  customers: {
    total_customers: number;
    sms_subscribers: number;
    email_subscribers: number;
    new_customers: number;
  };
  campaigns: {
    total_campaigns: number;
    sent_campaigns: number;
    recent_campaigns: number;
  };
  sends: {
    total_sends: number;
    successful_sends: number;
    failed_sends: number;
    sms_sent: number;
    emails_sent: number;
  };
  recent_activity: any[];
}

const StatCard = ({ icon: Icon, title, value, change, changeType, color }: {
  icon: any;
  title: string;
  value: string;
  change?: string;
  changeType?: 'increase' | 'decrease';
  color: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
        {change && (
          <p className={`text-sm mt-1 ${
            changeType === 'increase' ? 'text-green-600' : 'text-red-600'
          }`}>
            {change} from last period
          </p>
        )}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  </motion.div>
);

const CustomerCard = ({ customer, onEdit }: {
  customer: Customer;
  onEdit: (customer: Customer) => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all"
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center space-x-2">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">{customer.name}</h3>
          <div className="flex items-center space-x-1">
            {customer.opt_in_sms && (
              <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-full">
                SMS
              </span>
            )}
            {customer.opt_in_email && (
              <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded-full">
                Email
              </span>
            )}
          </div>
        </div>
        <div className="mt-2 space-y-1">
          {customer.email && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <AtSign className="h-3 w-3 mr-1" />
              {customer.email}
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Phone className="h-3 w-3 mr-1" />
              {customer.phone}
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {customer.total_orders} orders • ${customer.total_spent.toFixed(2)} spent
          </span>
          {customer.tags.length > 0 && (
            <div className="flex items-center space-x-1">
              <Tag className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-500">{customer.tags.length} tags</span>
            </div>
          )}
        </div>
      </div>
      <button
        onClick={() => onEdit(customer)}
        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
      >
        <Edit3 className="h-4 w-4" />
      </button>
    </div>
  </motion.div>
);

const CampaignCard = ({ campaign, onView, onSend }: {
  campaign: Campaign;
  onView: (campaign: Campaign) => void;
  onSend: (id: string) => void;
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-200';
      case 'sending': return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-200';
      case 'failed': return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-200';
      case 'scheduled': return 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-200';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return CheckCircle;
      case 'sending': return Clock;
      case 'failed': return XCircle;
      case 'scheduled': return Calendar;
      default: return Edit3;
    }
  };

  const StatusIcon = getStatusIcon(campaign.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${
              campaign.type === 'sms' ? 'bg-green-100 dark:bg-green-900' : 'bg-blue-100 dark:bg-blue-900'
            }`}>
              {campaign.type === 'sms' ? (
                <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">{campaign.name}</h3>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(campaign.status)}`}>
                  {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {campaign.total_recipients} recipients
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 line-clamp-2">
            {campaign.message}
          </p>
          {campaign.status === 'sent' && (
            <div className="mt-3 flex items-center space-x-4 text-sm">
              <span className="text-green-600">
                ✓ {campaign.successful_sends} sent
              </span>
              {campaign.failed_sends > 0 && (
                <span className="text-red-600">
                  ✗ {campaign.failed_sends} failed
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onView(campaign)}
            className="p-2 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Eye className="h-4 w-4" />
          </button>
          {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
            <button
              onClick={() => onSend(campaign.id)}
              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const CampaignForm = ({ onSave, onCancel }: {
  onSave: (data: any) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'sms' as 'sms' | 'email',
    message: '',
    subject: '',
    targetCriteria: {},
    scheduleAt: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (formData.type === 'email' && !formData.subject.trim()) {
      toast.error('Email subject is required');
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
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Create Marketing Campaign
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Campaign Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="e.g., Weekend Special Promotion"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Campaign Type *
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="sms"
                    checked={formData.type === 'sms'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'sms' | 'email' })}
                    className="mr-2"
                  />
                  <MessageSquare className="h-4 w-4 mr-1" />
                  SMS
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="email"
                    checked={formData.type === 'email'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'sms' | 'email' })}
                    className="mr-2"
                  />
                  <Mail className="h-4 w-4 mr-1" />
                  Email
                </label>
              </div>
            </div>

            {formData.type === 'email' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Subject *
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="e.g., Special Weekend Offer Just for You!"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Message *
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder={
                  formData.type === 'sms' 
                    ? 'Keep it short and sweet! (160 characters max)'
                    : 'Write your email message here...'
                }
                rows={formData.type === 'sms' ? 3 : 6}
              />
              {formData.type === 'sms' && (
                <p className={`text-sm mt-1 ${
                  formData.message.length > 160 ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {formData.message.length}/160 characters
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Schedule (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.scheduleAt}
                onChange={(e) => setFormData({ ...formData, scheduleAt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Leave empty to send immediately
              </p>
            </div>

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
                <Send className="h-4 w-4" />
                <span>Create Campaign</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

const CustomerForm = ({ customer, onSave, onCancel }: {
  customer?: Customer;
  onSave: (data: any) => void;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    tags: customer?.tags || [],
    optInSms: customer?.opt_in_sms || false,
    optInEmail: customer?.opt_in_email || false
  });

  const [newTag, setNewTag] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name && !formData.email && !formData.phone) {
      toast.error('Please provide at least name, email, or phone number');
      return;
    }
    onSave(formData);
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            {customer ? 'Edit Customer' : 'Add Customer'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Customer name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="customer@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Add a tag"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                >
                  Add
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200 px-2 py-1 rounded-full text-sm flex items-center space-x-1"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Marketing Preferences</h4>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.optInSms}
                    onChange={(e) => setFormData({ ...formData, optInSms: e.target.checked })}
                    className="mr-2"
                  />
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Opt-in to SMS marketing
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.optInEmail}
                    onChange={(e) => setFormData({ ...formData, optInEmail: e.target.checked })}
                    className="mr-2"
                  />
                  <Mail className="h-4 w-4 mr-1" />
                  Opt-in to Email marketing
                </label>
              </div>
            </div>

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
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                {customer ? 'Update' : 'Add'} Customer
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default function Marketing() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState<MarketingAnalytics | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch('/api/marketing/analytics', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await fetch('/api/marketing/customers', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setCustomers(data.data);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    try {
      const response = await fetch('/api/marketing/campaigns', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setCampaigns(data.data);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchAnalytics(), fetchCustomers(), fetchCampaigns()]);
      setLoading(false);
    };
    loadData();
  }, [fetchAnalytics, fetchCustomers, fetchCampaigns]);

  const handleSaveCampaign = async (formData: any) => {
    try {
      const response = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Campaign created successfully');
        setShowCampaignForm(false);
        await fetchCampaigns();
      } else {
        toast.error(data.error?.message || 'Failed to create campaign');
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
    }
  };

  const handleSendCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to send this campaign?')) return;

    try {
      const response = await fetch(`/api/marketing/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Campaign queued for sending');
        await fetchCampaigns();
      } else {
        toast.error(data.error?.message || 'Failed to send campaign');
      }
    } catch (error) {
      console.error('Error sending campaign:', error);
      toast.error('Failed to send campaign');
    }
  };

  const handleSaveCustomer = async (formData: any) => {
    try {
      const response = await fetch('/api/marketing/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        toast.success(editingCustomer ? 'Customer updated' : 'Customer added');
        setShowCustomerForm(false);
        setEditingCustomer(null);
        await fetchCustomers();
      } else {
        toast.error(data.error?.message || 'Failed to save customer');
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      toast.error('Failed to save customer');
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm)
  );

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'customers', name: 'Customers', icon: Users },
    { id: 'campaigns', name: 'Campaigns', icon: Send },
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
        <title>Marketing Dashboard - Servio</title>
      </Head>

      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Marketing Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage your customer relationships and marketing campaigns
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

          {/* Overview Tab */}
          {activeTab === 'overview' && analytics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  icon={Users}
                  title="Total Customers"
                  value={analytics.customers.total_customers.toString()}
                  change={`+${analytics.customers.new_customers}`}
                  changeType="increase"
                  color="bg-blue-500"
                />
                <StatCard
                  icon={MessageSquare}
                  title="SMS Subscribers"
                  value={analytics.customers.sms_subscribers.toString()}
                  color="bg-green-500"
                />
                <StatCard
                  icon={Mail}
                  title="Email Subscribers"
                  value={analytics.customers.email_subscribers.toString()}
                  color="bg-purple-500"
                />
                <StatCard
                  icon={Send}
                  title="Campaigns Sent"
                  value={analytics.campaigns.sent_campaigns.toString()}
                  change={`+${analytics.campaigns.recent_campaigns}`}
                  changeType="increase"
                  color="bg-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Recent Activity
                  </h3>
                  <div className="space-y-3">
                    {analytics.recent_activity.length > 0 ? (
                      analytics.recent_activity.map((activity: any, index: number) => (
                        <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className={`p-2 rounded-lg ${
                            activity.type === 'sms' ? 'bg-green-100 dark:bg-green-900' : 'bg-blue-100 dark:bg-blue-900'
                          }`}>
                            {activity.type === 'sms' ? (
                              <MessageSquare className="h-4 w-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {activity.type.toUpperCase()} to {activity.recipient}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Status: {activity.status}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Send Statistics
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Total Sends</span>
                      <span className="font-semibold">{analytics.sends.total_sends}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-green-600">Successful</span>
                      <span className="font-semibold text-green-600">{analytics.sends.successful_sends}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-red-600">Failed</span>
                      <span className="font-semibold text-red-600">{analytics.sends.failed_sends}</span>
                    </div>
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">SMS Sent</span>
                        <span className="font-semibold">{analytics.sends.sms_sent}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Emails Sent</span>
                        <span className="font-semibold">{analytics.sends.emails_sent}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Customers Tab */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-64"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setShowCustomerForm(true)}
                  className="flex items-center space-x-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Customer</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredCustomers.map((customer) => (
                  <CustomerCard
                    key={customer.id}
                    customer={customer}
                    onEdit={(customer) => {
                      setEditingCustomer(customer);
                      setShowCustomerForm(true);
                    }}
                  />
                ))}
              </div>

              {filteredCustomers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {customers.length === 0 ? 'No customers yet. Add your first customer!' : 'No customers match your search.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Campaigns Tab */}
          {activeTab === 'campaigns' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Marketing Campaigns
                </h2>
                <button
                  onClick={() => setShowCampaignForm(true)}
                  className="flex items-center space-x-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Campaign</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {campaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onView={(campaign) => {
                      // Minimal v1: show details in a toast until modal is implemented
                      toast.success(`Campaign: ${campaign.name || campaign.id}`)
                    }}
                    onSend={handleSendCampaign}
                  />
                ))}
              </div>

              {campaigns.length === 0 && (
                <div className="text-center py-12">
                  <Send className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No campaigns yet. Create your first marketing campaign!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Forms */}
          <AnimatePresence>
            {showCampaignForm && (
              <CampaignForm
                onSave={handleSaveCampaign}
                onCancel={() => setShowCampaignForm(false)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showCustomerForm && (
              <CustomerForm
                customer={editingCustomer || undefined}
                onSave={handleSaveCustomer}
                onCancel={() => {
                  setShowCustomerForm(false);
                  setEditingCustomer(null);
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </>
  );
}