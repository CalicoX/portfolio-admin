import React, { useState, useEffect } from 'react';
import { LogOut, Plus, Trash2, Edit2, Save, Upload, Loader2, RefreshCw, Image as ImageIcon, User, Lock, AlertTriangle, Key, X, Shield, Settings, Sparkles, LayoutDashboard } from 'lucide-react';
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
} from '../lib/adminAuth';
import { generateSetupUri } from '../lib/totp';

// Shadcn UI Components
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

// Content model definitions with icons
const CONTENT_MODELS = [
    { id: 'index', name: 'Index', description: 'Homepage settings', icon: LayoutDashboard },
    { id: 'navigation', name: 'Navigation', description: 'Nav menu items', icon: Settings },
    { id: 'photo', name: 'Photos', description: 'Photo gallery', icon: ImageIcon },
    { id: 'portfolio', name: 'Portfolio', description: 'UI/Graphic projects', icon: Sparkles },
    { id: 'stat', name: 'Stats', description: 'Statistics display', icon: Settings },
    { id: 'settings', name: 'Settings', description: 'Admin configuration', icon: Shield },
];

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

        // Initial check
        checkAuth();

        // Listen for changes in other tabs (token cleared)
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

    const fetchEntries = async () => {
        try {
            setLoading(true);
            setError(null);
            setEditingId(null);
            setIsAdding(false);
            resetForm();

            // Check for management token FIRST
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
            // Retry fetch
            fetchEntries();
        }
    };

    const handleGenerate2FA = async () => {
        const { secret, uri } = generateSetupUri('Admin', 'VibeCoding');
        setNewSecret(secret);
        // Use reliable external API for QR code generation
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`;
        setQrCodeUrl(url);
    };

    const handleLogout = () => {
        clearAuthToken();
        onLogout();
        // Redirect to portfolio website
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

    // Render Index form
    const renderIndexForm = () => {
        if (!indexData && !loading) {
            return (
                <div className="flex flex-col items-center justify-center py-20 px-4">
                    <div className="w-20 h-20 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mb-4">
                        <User size={36} className="text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Profile Found</h3>
                    <p className="text-sm text-muted-foreground text-center">Create an Index entry in Contentful first.</p>
                </div>
            );
        }

        return (
            <Card className="border-border/50 shadow-lg overflow-hidden">
                <CardHeader className="border-b border-border/50 bg-muted/30">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex-shrink-0 flex items-center justify-center overflow-hidden border border-border shadow-lg">
                                {indexData?.profileImageUrl ? (
                                    <img
                                        src={indexData.profileImageUrl}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <User size={32} className="text-primary/40" />
                                )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                                <Sparkles size={12} className="text-primary-foreground" />
                            </div>
                        </div>
                        <div>
                            <CardTitle className="text-xl">Profile Settings</CardTitle>
                            <CardDescription>Manage your homepage intro and personal details</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 grid gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2.5">
                            <Label className="text-sm font-medium">Hero Title</Label>
                            <Input
                                value={formData.heroTitle || ''}
                                onChange={(e) => setFormData({ ...formData, heroTitle: e.target.value })}
                                placeholder="Making Things"
                                className="h-10 bg-muted/50 border-muted focus:border-primary/50"
                            />
                        </div>
                        <div className="space-y-2.5">
                            <Label className="text-sm font-medium">Hero Subtitle</Label>
                            <Input
                                value={formData.heroSubtitle || ''}
                                onChange={(e) => setFormData({ ...formData, heroSubtitle: e.target.value })}
                                placeholder="Better"
                                className="h-10 bg-muted/50 border-muted focus:border-primary/50"
                            />
                        </div>
                        <div className="space-y-2.5">
                            <Label className="text-sm font-medium">Name</Label>
                            <Input
                                value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Your Name"
                                className="h-10 bg-muted/50 border-muted focus:border-primary/50"
                            />
                        </div>
                        <div className="space-y-2.5">
                            <Label className="text-sm font-medium">CV Link</Label>
                            <Input
                                value={formData.cvLink || ''}
                                onChange={(e) => setFormData({ ...formData, cvLink: e.target.value })}
                                placeholder="https://..."
                                className="h-10 bg-muted/50 border-muted focus:border-primary/50"
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2.5">
                            <Label className="text-sm font-medium">Description</Label>
                            <Textarea
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={4}
                                className="bg-muted/50 border-muted focus:border-primary/50 resize-none"
                                placeholder="A short bio..."
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2.5">
                            <Label className="text-sm font-medium">Profile Image</Label>
                            <div className="flex items-center gap-3">
                                <label className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 cursor-pointer">
                                    {uploadingImage ? (
                                        <Loader2 size={16} className="mr-2 animate-spin" />
                                    ) : (
                                        <Upload size={16} className="mr-2" />
                                    )}
                                    {uploadingImage ? 'Uploading...' : 'Upload Image'}
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, 'profileImageAssetId')}
                                        className="hidden"
                                        disabled={uploadingImage}
                                    />
                                </label>
                                {formData.profileImageAssetId && (
                                    <Badge variant="secondary" className="gap-1.5">
                                        <ImageIcon size={12} />
                                        Image uploaded
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t border-border/50 bg-muted/30 p-4">
                    <Button
                        onClick={handleUpdate}
                        disabled={saving}
                        className="shadow-lg shadow-primary/25"
                    >
                        {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    // Render Photo form
    const renderPhotoForm = () => {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2.5">
                    <Label className="text-sm font-medium">Title *</Label>
                    <Input
                        value={formData.title || ''}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Photo title"
                        className="h-10 bg-muted/50 border-muted focus:border-primary/50"
                    />
                </div>
                <div className="space-y-2.5">
                    <Label className="text-sm font-medium">Location</Label>
                    <Input
                        value={formData.location || ''}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Tokyo, Japan"
                        className="h-10 bg-muted/50 border-muted focus:border-primary/50"
                    />
                </div>
                <div className="space-y-2.5">
                    <Label className="text-sm font-medium">Date</Label>
                    <Input
                        type="date"
                        value={formData.date || ''}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="h-10 bg-muted/50 border-muted focus:border-primary/50"
                    />
                </div>
                <div className="space-y-2.5">
                    <Label className="text-sm font-medium">Aspect Ratio</Label>
                    <Select value={formData.aspectRatio || 'aspect-[3/4]'} onValueChange={(value) => setFormData({ ...formData, aspectRatio: value })}>
                        <SelectTrigger className="h-10 bg-muted/50 border-muted focus:border-primary/50">
                            <SelectValue placeholder="Select ratio" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="aspect-[3/4]">3:4 (Portrait)</SelectItem>
                            <SelectItem value="aspect-[4/3]">4:3 (Landscape)</SelectItem>
                            <SelectItem value="aspect-square">1:1 (Square)</SelectItem>
                            <SelectItem value="aspect-[16/9]">16:9 (Wide)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="md:col-span-2 space-y-2.5">
                    <Label className="text-sm font-medium">Image</Label>
                    <div className="flex items-center gap-3">
                        <label className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 cursor-pointer">
                            {uploadingImage ? (
                                <Loader2 size={16} className="mr-2 animate-spin" />
                            ) : (
                                <Upload size={16} className="mr-2" />
                            )}
                            {uploadingImage ? 'Uploading...' : 'Upload Image'}
                            <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e)}
                                className="hidden"
                                disabled={uploadingImage}
                            />
                        </label>
                        {formData.imageAssetId && (
                            <Badge variant="secondary" className="gap-1.5">
                                <ImageIcon size={12} />
                                Image uploaded
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Render Settings form
    const renderSettingsForm = () => {
        return (
            <Card className="border-border/50 shadow-lg overflow-hidden">
                <CardHeader className="border-b border-border/50 bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Shield className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Two-Factor Authentication</CardTitle>
                            <CardDescription>Add an extra layer of security to your account</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {!qrCodeUrl ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                                <Lock size={32} className="text-primary" />
                            </div>
                            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                                Protect your admin account with two-factor authentication using an authenticator app
                            </p>
                            <Button onClick={handleGenerate2FA} size="lg" className="shadow-lg shadow-primary/25">
                                <Lock className="mr-2 h-4 w-4" />
                                Setup 2FA
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-slide-up-fade">
                            <div className="flex justify-center">
                                <div className="bg-white p-6 rounded-2xl shadow-lg">
                                    <img src={qrCodeUrl} alt="2FA QR Code" className="w-56 h-56" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Secret Key</Label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-muted border border-border px-4 py-3 rounded-lg text-primary font-mono text-sm select-all">
                                        VITE_TOTP_SECRET={newSecret}
                                    </code>
                                </div>
                                <p className="text-xs text-muted-foreground">Add this to your .env file</p>
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                                <h4 className="font-semibold text-yellow-500 mb-3 flex items-center gap-2">
                                    <AlertTriangle size={18} />
                                    Setup Instructions
                                </h4>
                                <ul className="text-sm text-yellow-500/80 space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">1.</span>
                                        <span>Scan the QR code with <strong>Microsoft Authenticator</strong> or similar app</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">2.</span>
                                        <span>Copy the secret key above and add it to your <code>.env</code> file</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-bold">3.</span>
                                        <span>Restart your development server for changes to take effect</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    const renderComingSoon = () => (
        <Card className="border-border/50 shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mb-4">
                    <Settings size={28} className="text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                <p className="text-sm text-muted-foreground">Management for this content type will be available in a future update.</p>
            </CardContent>
        </Card>
    );

    const activeModel = CONTENT_MODELS.find(m => m.id === activeTab);
    const ActiveIcon = activeModel?.icon || Settings;

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/[0.02]">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
                <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                                <Shield className="w-5 h-5 text-primary-foreground" />
                            </div>
                            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Admin Panel</h1>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                Secure session active
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
                        <LogOut className="h-4 w-4" />
                        <span className="hidden sm:inline">Logout</span>
                    </Button>
                </div>
            </header>

            <main className="container max-w-6xl mx-auto px-4 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive flex items-center justify-between animate-slide-up-fade">
                        <div className="flex items-center gap-3">
                            <AlertTriangle size={18} />
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setError(null)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                            <X size={16} />
                        </Button>
                    </div>
                )}

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    {/* Modern Tabs */}
                    <div className="bg-muted/30 border border-border/50 rounded-2xl p-1.5">
                        <TabsList className="h-auto bg-transparent p-0 gap-1 w-full grid grid-cols-3 md:grid-cols-6">
                            {CONTENT_MODELS.map(model => {
                                const Icon = model.icon;
                                return (
                                    <TabsTrigger
                                        key={model.id}
                                        value={model.id}
                                        className="px-3 py-2.5 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary whitespace-nowrap text-sm font-medium text-muted-foreground hover:text-foreground transition-all gap-2"
                                    >
                                        <Icon size={16} />
                                        <span className="hidden md:inline">{model.name}</span>
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>
                    </div>

                    {/* Page Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <ActiveIcon size={20} className="text-primary" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">
                                    {activeModel?.name}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {activeModel?.description}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={fetchEntries}
                                disabled={loading}
                                className="h-10 w-10"
                            >
                                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            </Button>
                            {activeTab === 'photo' && !isAdding && !editingId && (
                                <Button onClick={startAdd} className="shadow-lg shadow-primary/25">
                                    <Plus size={16} className="mr-2" />
                                    <span className="hidden sm:inline">Add Photo</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    {loading && activeTab !== 'index' ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-4 border-primary/20" />
                                <Loader2 size={32} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-spin" />
                            </div>
                            <p className="text-sm text-muted-foreground">Loading content...</p>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            <TabsContent value="index" className="mt-0">
                                {renderIndexForm()}
                            </TabsContent>

                            <TabsContent value="settings" className="mt-0">
                                {renderSettingsForm()}
                            </TabsContent>

                            <TabsContent value="photo" className="mt-0 space-y-6">
                                {(isAdding || editingId) && (
                                    <Card className="border-border/50 shadow-lg overflow-hidden">
                                        <CardHeader className="border-b border-border/50 bg-muted/30">
                                            <CardTitle className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    {isAdding ? <Plus size={18} className="text-primary" /> : <Edit2 size={18} className="text-primary" />}
                                                </div>
                                                {isAdding ? 'Add New Photo' : 'Edit Photo'}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-6 pt-6">
                                            {renderPhotoForm()}
                                        </CardContent>
                                        <CardFooter className="flex gap-2 justify-end border-t border-border/50 bg-muted/30 p-4">
                                            <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
                                            <Button onClick={isAdding ? handleAdd : handleUpdate} disabled={saving} className="shadow-lg shadow-primary/25">
                                                {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                                                {saving ? 'Saving...' : 'Save'}
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                )}

                                {!isAdding && !editingId && (
                                    entries.length === 0 ? (
                                        <div className="text-center py-20 bg-gradient-to-br from-muted/30 to-muted/10 rounded-2xl border border-dashed border-border/50 flex flex-col items-center justify-center">
                                            <div className="w-20 h-20 rounded-2xl bg-muted/50 border border-border flex items-center justify-center mx-auto mb-4">
                                                <ImageIcon size={32} className="text-muted-foreground/50" />
                                            </div>
                                            <h3 className="text-lg font-semibold mb-2">No photos yet</h3>
                                            <p className="text-sm text-muted-foreground mb-6 max-w-sm">Start building your gallery with beautiful moments captured from your adventures.</p>
                                            <Button onClick={startAdd} className="shadow-lg shadow-primary/25">
                                                <Plus size={16} className="mr-2" />
                                                Add First Photo
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {entries.map((entry) => (
                                                <div
                                                    key={entry.id}
                                                    className="group flex items-center gap-4 p-4 bg-card/50 backdrop-blur border border-border/50 rounded-xl hover:bg-accent/50 hover:border-primary/20 transition-all duration-200"
                                                >
                                                    {/* Thumbnail */}
                                                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-muted/50 shadow-sm">
                                                        {entry.imageUrl ? (
                                                            <img
                                                                src={entry.imageUrl}
                                                                alt={entry.title}
                                                                className="h-full w-full object-cover"
                                                                loading="lazy"
                                                            />
                                                        ) : (
                                                            <div className="h-full w-full flex items-center justify-center">
                                                                <ImageIcon size={20} className="text-muted-foreground/30" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-medium text-base truncate">{entry.title}</h4>
                                                            <Badge variant={entry.isPublished ? "default" : "secondary"} className={`text-[10px] px-2 py-0.5 ${entry.isPublished ? 'bg-primary/10 text-primary border-primary/20' : ''}`}>
                                                                {entry.isPublished ? 'Published' : 'Draft'}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            {entry.subtitle ? (
                                                                <span className="truncate">{entry.subtitle}</span>
                                                            ) : (
                                                                <span className="italic opacity-50">No location</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => startEdit(entry)}>
                                                            <Edit2 size={16} />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => handleDelete(entry.id)}>
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}
                            </TabsContent>

                            {!['index', 'photo', 'settings'].includes(activeTab) && (
                                <TabsContent value={activeTab} className="mt-0">
                                    {renderComingSoon()}
                                </TabsContent>
                            )}
                        </div>
                    )}
                </Tabs>
            </main>

            {/* Token Input Modal */}
            {showTokenModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <Card className="w-full max-w-md mx-4 animate-scale-in border-border/50 shadow-2xl">
                        <CardHeader className="text-center pb-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25">
                                <Key size={28} className="text-primary-foreground" />
                            </div>
                            <CardTitle className="text-xl">API Access Required</CardTitle>
                            <CardDescription>
                                Connect to Contentful to manage your content
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-6 text-center">
                                This admin panel requires your Contentful Management Token (CMA). Your token is stored securely in your browser.
                            </p>

                            <form onSubmit={handleTokenSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="token" className="text-sm font-medium">Management Token (CMA)</Label>
                                    <Input
                                        id="token"
                                        type="password"
                                        value={tokenInput}
                                        onChange={(e) => setTokenInput(e.target.value)}
                                        placeholder="CFPAT-..."
                                        autoFocus
                                        className="h-11 bg-muted/50 border-muted focus:border-primary/50"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        <a href="https://app.contentful.com/deeplink?link=api-keys" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary transition-colors">
                                            Get your token here →
                                        </a>
                                    </p>
                                </div>

                                <Button type="submit" className="w-full h-11 shadow-lg shadow-primary/25">
                                    Connect & Save
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
