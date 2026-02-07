import React, { useState, useEffect } from 'react';
import { LogOut, Plus, Trash2, Edit2, Save, X, Upload, Loader2, RefreshCw, Image as ImageIcon, User, Lock, AlertTriangle, Key } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

// Content model definitions
const CONTENT_MODELS = [
    { id: 'index', name: 'Index', description: 'Homepage settings' },
    { id: 'navigation', name: 'Navigation', description: 'Nav menu items' },
    { id: 'photo', name: 'Photos', description: 'Photo gallery' },
    { id: 'portfolio', name: 'Portfolio', description: 'UI/Graphic projects' },
    { id: 'stat', name: 'Stats', description: 'Statistics display' },
    { id: 'settings', name: 'Settings', description: 'Admin configuration' },
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

    const handleTokenSubmit = (e: React.FormEvent) => {
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
                <div className="text-center py-12 text-muted-foreground">
                    No Index entry found. Create one in Contentful first.
                </div>
            );
        }

        return (
            <Card className="border-border/50 bg-card/60">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center overflow-hidden border border-input">
                            {indexData?.profileImageUrl ? (
                                <img
                                    src={indexData.profileImageUrl}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <User size={24} className="text-muted-foreground" />
                            )}
                        </div>
                        <div>
                            {/* Static Title to prevent layout breakage from long content */}
                            <CardTitle>Profile Settings</CardTitle>
                            <CardDescription>Manage your homepage intro and personal details.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-6">
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
                            <textarea
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={4}
                                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="A short bio..."
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <Label>Profile Image</Label>
                            <div className="flex items-center gap-4">
                                <Label
                                    className="flex items-center gap-2 cursor-pointer border border-input bg-secondary/50 hover:bg-secondary/80 h-10 px-4 rounded-md text-sm font-medium transition-colors"
                                >
                                    {uploadingImage ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <Upload size={16} />
                                    )}
                                    <span>{uploadingImage ? 'Uploading...' : 'Upload Image'}</span>
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageUpload(e, 'profileImageAssetId')}
                                        className="hidden"
                                        disabled={uploadingImage}
                                    />
                                </Label>
                                {formData.profileImageAssetId && (
                                    <span className="flex items-center gap-2 text-sm text-green-500">
                                        <ImageIcon size={16} />
                                        Image uploaded
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/30 border-t border-border/50 p-6 flex justify-end">
                    <Button
                        onClick={handleUpdate}
                        disabled={saving}
                        className="w-full sm:w-auto min-w-[120px]"
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
                    <Input
                        type="date"
                        value={formData.date || ''}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Aspect Ratio</Label>
                    <select
                        value={formData.aspectRatio || 'aspect-[3/4]'}
                        onChange={(e) => setFormData({ ...formData, aspectRatio: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <option value="aspect-[3/4]">3:4 (Portrait)</option>
                        <option value="aspect-[4/3]">4:3 (Landscape)</option>
                        <option value="aspect-square">1:1 (Square)</option>
                        <option value="aspect-[16/9]">16:9 (Wide)</option>
                    </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                    <Label>Image</Label>
                    <div className="flex items-center gap-4">
                        <Label
                            className="flex items-center gap-2 cursor-pointer border border-input bg-secondary/50 hover:bg-secondary/80 h-10 px-4 rounded-md text-sm font-medium transition-colors"
                        >
                            {uploadingImage ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Upload size={16} />
                            )}
                            <span>{uploadingImage ? 'Uploading...' : 'Upload Image'}</span>
                            <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e)}
                                className="hidden"
                                disabled={uploadingImage}
                            />
                        </Label>
                        {formData.imageAssetId && (
                            <span className="flex items-center gap-2 text-sm text-green-500">
                                <ImageIcon size={16} />
                                Image uploaded
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Render Settings form
    const renderSettingsForm = () => {
        return (
            <Card className="border-border/50 bg-card/60">
                <CardHeader>
                    <CardTitle>Two-Factor Authentication</CardTitle>
                    <CardDescription>
                        Add an extra layer of security using Microsoft Authenticator or Google Authenticator.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!qrCodeUrl ? (
                        <div className="flex flex-col gap-4">
                            <Button onClick={handleGenerate2FA} className="w-fit">
                                <Lock className="mr-2 h-4 w-4" />
                                Setup 2FA
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="bg-white p-4 rounded-lg w-fit">
                                <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                            </div>

                            <div className="space-y-2">
                                <Label>Secret Key (Add to .env)</Label>
                                <div className="flex items-center gap-2">
                                    <code className="bg-muted px-3 py-2 rounded text-primary font-mono border select-all block w-full">
                                        VITE_TOTP_SECRET={newSecret}
                                    </code>
                                </div>
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                                <h4 className="font-semibold text-yellow-500 mb-1 flex items-center gap-2">
                                    <AlertTriangle size={18} /> Important
                                </h4>
                                <ul className="text-sm text-yellow-500/80 space-y-1 list-disc list-inside">
                                    <li>Scan the QR code with <strong>Microsoft Authenticator</strong>.</li>
                                    <li>Copy the line above and add/update it in your local <code>.env</code> file.</li>
                                    <li>Restart your development server for changes to take effect.</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    const renderComingSoon = () => (
        <Card className="border-border/50 bg-card/60">
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <p>Management for this content type coming soon...</p>
            </CardContent>
        </Card>
    );

    return (
        <div className="min-h-screen bg-background text-foreground font-inter antialiased">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                            <span className="text-primary-foreground font-bold text-sm">A</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold tracking-tight">Admin</h1>
                            <p className="text-xs text-muted-foreground">Secure session active</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Logout</span>
                    </Button>
                </div>
            </header>

            <main className="container max-w-5xl mx-auto px-4 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-destructive/15 border border-destructive/50 rounded-lg text-destructive flex items-center justify-between animate-fade-in">
                        <span className="text-sm font-medium">{error}</span>
                        <Button variant="ghost" size="icon" onClick={() => setError(null)} className="h-6 w-6 text-destructive hover:bg-destructive/10">
                            <X size={14} />
                        </Button>
                    </div>
                )}

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                    {/* Simplified Tabs List */}
                    <div className="border-b border-border/50 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                        <TabsList className="h-auto bg-transparent p-0 gap-0 w-full min-w-max md:min-w-0 grid grid-cols-6">
                            {CONTENT_MODELS.map(model => (
                                <TabsTrigger
                                    key={model.id}
                                    value={model.id}
                                    className="px-3 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none whitespace-nowrap text-sm"
                                >
                                    {model.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="flex items-center justify-between pb-2 border-b border-border/50">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">
                                {CONTENT_MODELS.find(m => m.id === activeTab)?.name}
                            </h2>
                            <p className="text-muted-foreground mt-1">
                                {CONTENT_MODELS.find(m => m.id === activeTab)?.description}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={fetchEntries}
                                disabled={loading}
                            >
                                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            </Button>
                            {activeTab === 'photo' && !isAdding && !editingId && (
                                <Button onClick={startAdd}>
                                    <Plus size={16} className="mr-2" />
                                    Create Photo
                                </Button>
                            )}
                        </div>
                    </div>

                    {loading && activeTab !== 'index' && (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={32} className="animate-spin text-primary" />
                        </div>
                    )}

                    {!loading && (
                        <div className="animate-fade-in">
                            <TabsContent value="index" className="mt-0">
                                {renderIndexForm()}
                            </TabsContent>

                            <TabsContent value="settings" className="mt-0">
                                {renderSettingsForm()}
                            </TabsContent>

                            <TabsContent value="photo" className="mt-0 space-y-6">
                                {(isAdding || editingId) && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>{isAdding ? 'Add New Photo' : 'Edit Photo'}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {renderPhotoForm()}
                                        </CardContent>
                                        <CardFooter className="flex gap-2 justify-end bg-muted/50 p-6">
                                            <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
                                            <Button onClick={isAdding ? handleAdd : handleUpdate} disabled={saving} className="min-w-[100px]">
                                                {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                                                {saving ? 'Saving...' : 'Save'}
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                )}

                                {!isAdding && !editingId && (
                                    entries.length === 0 ? (
                                        <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed flex flex-col items-center justify-center">
                                            <ImageIcon size={48} className="text-muted-foreground mb-4 opacity-50" />
                                            <h3 className="text-lg font-medium">No photos yet</h3>
                                            <p className="text-sm text-muted-foreground mb-4">Start building your gallery.</p>
                                            <Button onClick={startAdd}>
                                                <Plus size={16} className="mr-2" />
                                                Add First Photo
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {entries.map((entry) => (
                                                <div
                                                    key={entry.id}
                                                    className="flex items-center gap-4 p-3 bg-card/40 border border-border/40 rounded-lg hover:bg-accent/5 transition-colors group"
                                                >
                                                    {/* Thumbnail */}
                                                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-border/50 bg-muted relative">
                                                        {entry.imageUrl ? (
                                                            <img
                                                                src={entry.imageUrl}
                                                                alt={entry.title}
                                                                className="h-full w-full object-cover"
                                                                loading="lazy"
                                                            />
                                                        ) : (
                                                            <div className="h-full w-full flex items-center justify-center">
                                                                <ImageIcon size={14} className="text-muted-foreground/50" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0 grid gap-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-medium text-sm truncate text-foreground/90">{entry.title}</h4>
                                                            <span className={`px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border ${entry.isPublished
                                                                ? 'bg-green-500/5 text-green-500 border-green-500/20'
                                                                : 'bg-yellow-500/5 text-yellow-500 border-yellow-500/20'
                                                                }`}>
                                                                {entry.isPublished ? 'Published' : 'Draft'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            {entry.subtitle ? (
                                                                <span className="truncate max-w-[200px]">{entry.subtitle}</span>
                                                            ) : (
                                                                <span className="italic opacity-50">No location</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => startEdit(entry)}>
                                                            <Edit2 size={14} />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(entry.id)}>
                                                            <Trash2 size={14} />
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
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-accent/20 rounded-lg">
                                    <Key size={20} className="text-accent" />
                                </div>
                                <h3 className="text-lg font-semibold">
                                    Setup API Access
                                </h3>
                            </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-4">
                            This static site requires your Contentful Management Token (CMA) to manage content. It will be stored securely in your browser.
                        </p>

                        <form onSubmit={handleTokenSubmit}>
                            <div className="space-y-3 mb-4">
                                <Label>Management Token (CMA)</Label>
                                <Input
                                    type="password"
                                    value={tokenInput}
                                    onChange={(e) => setTokenInput(e.target.value)}
                                    placeholder="CFPAT-..."
                                    className="bg-zinc-800 border-zinc-700"
                                    autoFocus
                                />
                                <p className="text-xs text-zinc-500">
                                    <a href="https://app.contentful.com/deeplink?link=api-keys" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
                                        Get your token here
                                    </a>
                                </p>
                            </div>

                            <Button type="submit" className="w-full">
                                Save & Connect
                            </Button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
