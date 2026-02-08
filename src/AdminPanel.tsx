import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  Upload,
  Loader2,
  RefreshCw,
  Image as ImageIcon,
  User,
  Lock,
  AlertTriangle,
  Key,
  X,
  Settings,
} from 'lucide-react';
import {
  getPhotosAdmin,
  createPhoto,
  updatePhoto,
  deletePhoto,
  uploadAsset,
  getIndexAdmin,
  updateIndex,
  setManagementToken,
  hasManagementToken,
} from '../lib/contentfulManagement';
import {
  validateAuthToken,
  getStoredAuthToken,
  clearAuthToken,
  updateLastActivity,
  isInactiveSession,
} from '../lib/adminAuth';
import { generateSetupUri } from '../lib/totp';

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DatePicker } from "@/components/ui/date-picker";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

// Admin Components
import { AdminSidebar } from "@/components/admin-sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface EntryItem {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  isPublished: boolean;
  rawData: any;
}

interface IndexData {
  id: string;
  heroTitle: string;
  heroSubtitle: string;
  name: string;
  description: string;
  cvLink: string;
  profileImageAssetId: string | null;
  profileImageUrl: string | null;
  isPublished: boolean;
}

interface AdminPanelProps {
  onLogout: () => void;
}

// Navigation items - matching admin-sidebar data
const navItems = [
  { title: "Index", url: "#index", id: "index" },
  { title: "Navigation", url: "#navigation", id: "navigation" },
  { title: "Photos", url: "#photo", id: "photo" },
  { title: "Portfolio", url: "#portfolio", id: "portfolio" },
  { title: "Stats", url: "#stat", id: "stat" },
  { title: "Settings", url: "#settings", id: "settings" },
];

const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('index');
  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [indexData, setIndexData] = useState<IndexData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [newSecret, setNewSecret] = useState('');

  // Token Management State
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  // Check authentication with secure token validation
  useEffect(() => {
    const checkAuth = async () => {
      const token = getStoredAuthToken();
      const expectedHash = import.meta.env.VITE_ADMIN_PASSWORD_HASH || '';

      if (!token || !(await validateAuthToken(token, expectedHash))) {
        clearAuthToken();
        onLogout();
      }
    };

    checkAuth();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === '_as_t' && !e.newValue) {
        onLogout();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [onLogout]);

  // Fetch entries when tab changes
  useEffect(() => {
    fetchEntries();
  }, [activeTab]);

  // Handle hash change for navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && navItems.find(item => item.id === hash)) {
        setActiveTab(hash);
      }
    };

    // Check initial hash
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Inactivity timeout - auto logout after 30 minutes of no activity
  useEffect(() => {
    // Initialize activity timestamp on mount
    updateLastActivity();

    // Events that count as user activity
    const activityEvents = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'
    ];

    const handleActivity = () => {
      updateLastActivity();
    };

    // Add activity listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Check inactivity every minute
    const inactivityCheck = setInterval(() => {
      if (isInactiveSession()) {
        clearAuthToken();
        onLogout();
      }
    }, 60 * 1000); // Check every minute

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(inactivityCheck);
    };
  }, [onLogout]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      setEditingId(null);
      setIsAdding(false);
      resetForm();

      if (!hasManagementToken()) {
        setShowTokenModal(true);
        setLoading(false);
        return;
      }

      if (activeTab === 'index') {
        const data = await getIndexAdmin();
        setIndexData(data);
        if (data) {
          setFormData({
            heroTitle: data.heroTitle,
            heroSubtitle: data.heroSubtitle,
            name: data.name,
            description: data.description,
            cvLink: data.cvLink,
            profileImageAssetId: data.profileImageAssetId,
          });
          setEditingId(data.id);
        }
        setEntries([]);
      } else if (activeTab === 'photo') {
        const data = await getPhotosAdmin();
        setEntries(data.map(item => ({
          id: item.id,
          title: item.title,
          subtitle: item.location,
          imageUrl: item.imageUrl,
          isPublished: item.isPublished,
          rawData: item,
        })));
        setIndexData(null);
      } else {
        setEntries([]);
        setIndexData(null);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === 'CONTENTFUL_TOKEN_MISSING' || (err.message && err.message.includes('token'))) {
        setShowTokenModal(true);
      } else {
        setError(err.message || 'Failed to fetch entries');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTokenSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (tokenInput.trim()) {
      setManagementToken(tokenInput.trim());
      setShowTokenModal(false);
      setLoading(true);
      fetchEntries();
    }
  };

  const handleGenerate2FA = async () => {
    const { secret, uri } = generateSetupUri('Admin', 'VibeCoding');
    setNewSecret(secret);
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`;
    setQrCodeUrl(url);
  };

  const handleLogout = () => {
    clearAuthToken();
    onLogout();
    window.location.href = 'https://calicox.github.io/portfolio-website';
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string = 'imageAssetId') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const assetId = await uploadAsset(file);
      setFormData(prev => ({ ...prev, [fieldName]: assetId }));
    } catch (err: any) {
      if (err.message === 'CONTENTFUL_TOKEN_MISSING') {
        setShowTokenModal(true);
      } else {
        setError('Failed to upload image: ' + err.message);
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.title) {
      setError('Title is required');
      return;
    }

    try {
      setSaving(true);
      if (activeTab === 'photo') {
        await createPhoto({
          title: formData.title,
          location: formData.location || '',
          date: formData.date || undefined,
          aspectRatio: formData.aspectRatio || 'aspect-[3/4]',
          imageAssetId: formData.imageAssetId,
        });
      }
      await fetchEntries();
      setIsAdding(false);
      resetForm();
    } catch (err: any) {
      if (err.message === 'CONTENTFUL_TOKEN_MISSING') {
        setShowTokenModal(true);
      } else {
        setError('Failed to create: ' + err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;

    try {
      setSaving(true);
      if (activeTab === 'index') {
        await updateIndex(editingId, {
          heroTitle: formData.heroTitle,
          heroSubtitle: formData.heroSubtitle,
          name: formData.name,
          description: formData.description,
          cvLink: formData.cvLink,
          profileImageAssetId: formData.profileImageAssetId,
        });
      } else if (activeTab === 'photo') {
        await updatePhoto(editingId, {
          title: formData.title,
          location: formData.location,
          date: formData.date || undefined,
          aspectRatio: formData.aspectRatio,
          imageAssetId: formData.imageAssetId,
        });
      }
      await fetchEntries();
      if (activeTab !== 'index') {
        setEditingId(null);
        resetForm();
      }
    } catch (err: any) {
      if (err.message === 'CONTENTFUL_TOKEN_MISSING') {
        setShowTokenModal(true);
      } else {
        setError('Failed to update: ' + err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      setSaving(true);
      if (activeTab === 'photo') {
        await deletePhoto(id);
      }
      await fetchEntries();
    } catch (err: any) {
      if (err.message === 'CONTENTFUL_TOKEN_MISSING') {
        setShowTokenModal(true);
      } else {
        setError('Failed to delete: ' + err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry: EntryItem) => {
    setEditingId(entry.id);
    if (activeTab === 'photo') {
      setFormData({
        title: entry.rawData.title,
        location: entry.rawData.location,
        date: entry.rawData.date,
        aspectRatio: entry.rawData.aspectRatio,
        imageAssetId: entry.rawData.imageAssetId,
      });
    }
    setIsAdding(false);
  };

  const startAdd = () => {
    resetForm();
    setIsAdding(true);
    setEditingId(null);
  };

  const resetForm = () => {
    setFormData({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    resetForm();
  };

  const activeNavItem = navItems.find(item => item.id === activeTab);

  // Render content based on active tab
  const renderContent = () => {
    if (loading && activeTab !== 'index') {
      return (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 size={32} className="text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading content...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'index':
        return renderIndexForm();
      case 'photo':
        return renderPhotoList();
      case 'settings':
        return renderSettingsForm();
      default:
        return renderComingSoon();
    }
  };

  const renderIndexForm = () => {
    if (!indexData && !loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-lg bg-muted border border-border flex items-center justify-center mb-4">
            <User size={32} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Profile Found</h3>
          <p className="text-sm text-muted-foreground">Create an Index entry in Contentful first.</p>
        </div>
      );
    }

    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={indexData?.profileImageUrl || ''} />
              <AvatarFallback><User size={24} /></AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Manage your homepage intro and personal details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hero Title</Label>
              <Input
                value={formData.heroTitle || ''}
                onChange={(e) => setFormData({ ...formData, heroTitle: e.target.value })}
                placeholder="Making Things"
              />
            </div>
            <div className="space-y-2">
              <Label>Hero Subtitle</Label>
              <Input
                value={formData.heroSubtitle || ''}
                onChange={(e) => setFormData({ ...formData, heroSubtitle: e.target.value })}
                placeholder="Better"
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your Name"
              />
            </div>
            <div className="space-y-2">
              <Label>CV Link</Label>
              <Input
                value={formData.cvLink || ''}
                onChange={(e) => setFormData({ ...formData, cvLink: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="A short bio..."
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Profile Image</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    {uploadingImage ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Upload size={14} className="mr-2" />}
                    {uploadingImage ? 'Uploading...' : 'Upload'}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'profileImageAssetId')}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                </Button>
                {formData.profileImageAssetId && (
                  <Badge variant="outline">
                    <ImageIcon size={12} className="mr-1" />
                    Uploaded
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={handleUpdate} disabled={saving}>
            {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  const renderPhotoList = () => {
    return (
      <div className="space-y-4">
        {(isAdding || editingId) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isAdding ? <Plus size={18} /> : <Edit2 size={18} />}
                {isAdding ? 'Add New Photo' : 'Edit Photo'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Photo title"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Tokyo, Japan"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <DatePicker
                    value={formData.date || ''}
                    onChange={(value) => setFormData({ ...formData, date: value })}
                    placeholder="Select date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Aspect Ratio</Label>
                  <Select value={formData.aspectRatio || 'aspect-[3/4]'} onValueChange={(value) => setFormData({ ...formData, aspectRatio: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aspect-[3/4]">3:4 Portrait</SelectItem>
                      <SelectItem value="aspect-[4/3]">4:3 Landscape</SelectItem>
                      <SelectItem value="aspect-square">1:1 Square</SelectItem>
                      <SelectItem value="aspect-[16/9]">16:9 Wide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Image</Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <label className="cursor-pointer">
                        {uploadingImage ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Upload size={14} className="mr-2" />}
                        {uploadingImage ? 'Uploading...' : 'Upload'}
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e)}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                      </label>
                    </Button>
                    {formData.imageAssetId && (
                      <Badge variant="outline">
                        <ImageIcon size={12} className="mr-1" />
                        Uploaded
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
              <Button onClick={isAdding ? handleAdd : handleUpdate} disabled={saving}>
                {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </CardFooter>
          </Card>
        )}

        {!isAdding && !editingId && (
          entries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center mb-4">
                  <ImageIcon size={24} className="text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No photos yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Start building your gallery.</p>
                <Button onClick={startAdd}>
                  <Plus size={16} className="mr-2" />
                  Add First Photo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {entries.map((entry) => (
                <Card
                  key={entry.id}
                  className="group overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => startEdit(entry)}
                >
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {entry.imageUrl ? (
                      <img src={entry.imageUrl} alt={entry.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <ImageIcon size={48} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                        onClick={(e) => { e.stopPropagation(); startEdit(entry); }}
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8 bg-destructive/80 backdrop-blur-sm hover:bg-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                    <Badge variant={entry.isPublished ? "default" : "secondary"} className={entry.isPublished ? "absolute top-2 left-2 bg-green-500 hover:bg-green-600 text-white" : "absolute top-2 left-2"}>
                      {entry.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    <h4 className="font-medium truncate">{entry.title}</h4>
                    <p className="text-sm text-muted-foreground truncate">
                      {entry.subtitle || 'No location'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}
      </div>
    );
  };

  const renderSettingsForm = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>Add an extra layer of security to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!qrCodeUrl ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                <Lock size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                Protect your account with two-factor authentication
              </p>
              <Button onClick={handleGenerate2FA}>
                <Lock className="mr-2 h-4 w-4" />
                Setup 2FA
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg border">
                  <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Secret Key</Label>
                <code className="block bg-muted border border-border px-3 py-2 rounded-md font-mono text-sm">
                  VITE_TOTP_SECRET={newSecret}
                </code>
                <p className="text-xs text-muted-foreground">Add to .env file</p>
              </div>
              <div className="bg-muted/50 border border-border rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Setup Instructions
                </h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Scan QR code with authenticator app</li>
                  <li>Add secret key to .env file</li>
                  <li>Restart development server</li>
                </ol>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderComingSoon = () => (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center mb-4">
          <Settings size={24} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
        <p className="text-sm text-muted-foreground">This feature is under development.</p>
      </CardContent>
    </Card>
  );

  return (
    <SidebarProvider defaultOpen={true}>
      <AdminSidebar onLogout={handleLogout} avatar={indexData?.profileImageUrl || ''} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b transition-all duration-200 ease-in-out sticky top-0 z-[5] bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">Admin</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                {(activeTab === 'photo' && (isAdding || editingId)) ? (
                  <>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#" onClick={() => { cancelEdit(); }}>Photos</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{isAdding ? 'Add Photo' : 'Edit Photo'}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                ) : (
                  <BreadcrumbItem>
                    <BreadcrumbPage>{activeNavItem?.title || 'Dashboard'}</BreadcrumbPage>
                  </BreadcrumbItem>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-6 min-h-0">
          {/* Page Header */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight">{activeNavItem?.title}</h1>
              <p className="text-muted-foreground mt-1">
                Manage your {activeNavItem?.title.toLowerCase()} content
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={fetchEntries} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                <span className="sr-only">Refresh</span>
              </Button>
              {activeTab === 'photo' && !isAdding && !editingId && (
                <Button onClick={startAdd}>
                  <Plus size={16} className="mr-2" />
                  Add Photo
                </Button>
              )}
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/10 text-destructive flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} />
                <span className="text-sm">{error}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setError(null)} className="h-6 w-6">
                <X size={14} />
              </Button>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            {renderContent()}
          </div>
        </div>

        {/* Token Input Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md mx-4 shadow-lg">
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-4">
                <Key size={24} />
              </div>
              <CardTitle>API Access Required</CardTitle>
              <CardDescription>Connect to Contentful to manage your content</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTokenSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Management Token</Label>
                  <Input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="CFPAT-..."
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    <a href="https://app.contentful.com/deeplink?link=api-keys" target="_blank" rel="noopener noreferrer" className="underline">
                      Get your token here →
                    </a>
                  </p>
                </div>
                <Button type="submit" className="w-full">
                  Connect & Save
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AdminPanel;
