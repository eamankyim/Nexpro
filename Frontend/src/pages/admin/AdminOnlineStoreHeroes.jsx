import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImagePlus, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import adminService from '../../services/adminService';
import { API_BASE_URL } from '../../services/api';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import { showError, showSuccess } from '../../utils/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const resolveUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL || ''}${url}`;
  return url;
};

/**
 * Platform Admin CMS for Online Store hero designs and colorways.
 */
const AdminOnlineStoreHeroes = () => {
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const canManage = hasPermission('settings.view');

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [designDialogOpen, setDesignDialogOpen] = useState(false);
  const [colorwayDialogOpen, setColorwayDialogOpen] = useState(false);
  const [activeDesign, setActiveDesign] = useState(null);
  const [saving, setSaving] = useState(false);

  const [designForm, setDesignForm] = useState({
    categoryId: '',
    name: '',
    description: '',
    sortOrder: 0,
    isActive: true,
    thumbnail: null,
  });
  const [colorwayForm, setColorwayForm] = useState({
    label: '',
    hexHint: '#166534',
    sortOrder: 0,
    isActive: true,
    image: null,
  });
  const [newCategoryName, setNewCategoryName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getOnlineStoreHeroLibrary();
      const payload = res?.data !== undefined ? res.data : res;
      setCategories(Array.isArray(payload) ? payload : []);
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || 'Failed to load hero library');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!permissionsLoading && canManage) load();
  }, [permissionsLoading, canManage, load]);

  const designs = useMemo(() => {
    const list = categories.flatMap((cat) =>
      (cat.designs || []).map((d) => ({ ...d, categoryName: cat.name, categoryId: d.categoryId || cat.id }))
    );
    if (selectedCategoryId === 'all') return list;
    return list.filter((d) => d.categoryId === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  const openCreateDesign = () => {
    setDesignForm({
      categoryId: selectedCategoryId !== 'all' ? selectedCategoryId : categories[0]?.id || '',
      name: '',
      description: '',
      sortOrder: 0,
      isActive: true,
      thumbnail: null,
    });
    setDesignDialogOpen(true);
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await adminService.createOnlineStoreHeroCategory({ name });
      setNewCategoryName('');
      showSuccess('Category created');
      await load();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDesign = async () => {
    if (!designForm.categoryId || !designForm.name.trim()) {
      showError('Category and name are required');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('categoryId', designForm.categoryId);
      formData.append('name', designForm.name.trim());
      formData.append('description', designForm.description || '');
      formData.append('sortOrder', String(designForm.sortOrder || 0));
      formData.append('isActive', String(designForm.isActive));
      if (designForm.thumbnail) formData.append('thumbnail', designForm.thumbnail);
      await adminService.createOnlineStoreHeroDesign(formData);
      showSuccess('Design created');
      setDesignDialogOpen(false);
      await load();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to save design');
    } finally {
      setSaving(false);
    }
  };

  const openAddColorway = (design) => {
    setActiveDesign(design);
    setColorwayForm({
      label: '',
      hexHint: '#166534',
      sortOrder: (design.colorways || []).length,
      isActive: true,
      image: null,
    });
    setColorwayDialogOpen(true);
  };

  const handleSaveColorway = async () => {
    if (!activeDesign?.id || !colorwayForm.label.trim() || !colorwayForm.image) {
      showError('Label and image are required');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('designId', activeDesign.id);
      formData.append('label', colorwayForm.label.trim());
      formData.append('hexHint', colorwayForm.hexHint || '');
      formData.append('sortOrder', String(colorwayForm.sortOrder || 0));
      formData.append('isActive', String(colorwayForm.isActive));
      formData.append('image', colorwayForm.image);
      await adminService.createOnlineStoreHeroColorway(formData);
      showSuccess('Colorway added');
      setColorwayDialogOpen(false);
      await load();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to save colorway');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDesign = async (design) => {
    if (!window.confirm(`Delete design “${design.name}” and all its colorways?`)) return;
    try {
      await adminService.deleteOnlineStoreHeroDesign(design.id);
      showSuccess('Design deleted');
      await load();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to delete design');
    }
  };

  const handleDeleteColorway = async (colorway) => {
    if (!window.confirm(`Delete colorway “${colorway.label}”?`)) return;
    try {
      await adminService.deleteOnlineStoreHeroColorway(colorway.id);
      showSuccess('Colorway deleted');
      await load();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to delete colorway');
    }
  };

  const handleToggleDesign = async (design) => {
    try {
      const formData = new FormData();
      formData.append('isActive', String(!design.isActive));
      await adminService.updateOnlineStoreHeroDesign(design.id, formData);
      await load();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to update design');
    }
  };

  if (permissionsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-700" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-600">
          You do not have permission to manage the hero library.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Hero library</h1>
          <p className="mt-1 text-sm text-slate-600">
            Upload Online Store hero designs with 3–5 colorways. Merchants pick designs; we match color to their brand.
            Prefer 1920×600 images.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button type="button" className="bg-green-700 hover:bg-green-800" onClick={openCreateDesign}>
            <Plus className="mr-2 h-4 w-4" />
            Add design
          </Button>
        </div>
      </div>

      <Card className="border border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Categories</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Filter designs</Label>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 gap-2">
            <div className="flex-1 space-y-2">
              <Label>New category</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Home & Living"
              />
            </div>
            <Button type="button" variant="outline" className="mt-7" onClick={handleCreateCategory} disabled={saving}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-green-700" />
        </div>
      ) : designs.length === 0 ? (
        <Card className="border border-dashed border-slate-300">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <ImagePlus className="h-10 w-10 text-slate-400" />
            <p className="text-sm text-slate-600">No designs yet. Add a design, then upload colorway images.</p>
            <Button type="button" className="bg-green-700 hover:bg-green-800" onClick={openCreateDesign}>
              Add design
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {designs.map((design) => (
            <Card key={design.id} className="border border-slate-200">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{design.name}</CardTitle>
                    <Badge variant="outline">{design.categoryName}</Badge>
                    {!design.isActive && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  {design.description ? (
                    <p className="mt-1 text-xs text-slate-500">{design.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={design.isActive} onCheckedChange={() => handleToggleDesign(design)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteDesign(design)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(design.colorways || []).map((cw) => (
                    <div key={cw.id} className="relative overflow-hidden rounded-lg border border-slate-200">
                      <img
                        src={resolveUrl(cw.imageUrl)}
                        alt={cw.label}
                        className="aspect-[16/5] w-full object-cover"
                      />
                      <div className="flex items-center justify-between gap-1 border-t border-slate-200 px-2 py-1">
                        <span className="truncate text-xs font-medium">{cw.label}</span>
                        <span
                          className="h-3 w-3 shrink-0 rounded-full border border-slate-300"
                          style={{ backgroundColor: cw.hexHint || '#ccc' }}
                          title={cw.hexHint || ''}
                        />
                        <button type="button" className="text-red-600" onClick={() => handleDeleteColorway(cw)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => openAddColorway(design)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add colorway
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={designDialogOpen} onOpenChange={setDesignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add hero design</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={designForm.categoryId}
                onValueChange={(value) => setDesignForm((prev) => ({ ...prev, categoryId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={designForm.name}
                onChange={(e) => setDesignForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Electronics Wave"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={designForm.description}
                onChange={(e) => setDesignForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Thumbnail (optional)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setDesignForm((prev) => ({ ...prev, thumbnail: e.target.files?.[0] || null }))}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDesignDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="bg-green-700 hover:bg-green-800" onClick={handleSaveDesign} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={colorwayDialogOpen} onOpenChange={setColorwayDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add colorway{activeDesign ? ` — ${activeDesign.name}` : ''}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={colorwayForm.label}
                onChange={(e) => setColorwayForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Blue"
              />
            </div>
            <div className="space-y-2">
              <Label>Hex hint (for brand matching)</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  className="h-10 w-14 p-1"
                  value={colorwayForm.hexHint}
                  onChange={(e) => setColorwayForm((prev) => ({ ...prev, hexHint: e.target.value }))}
                />
                <Input
                  value={colorwayForm.hexHint}
                  onChange={(e) => setColorwayForm((prev) => ({ ...prev, hexHint: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Image (1920×600 recommended)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setColorwayForm((prev) => ({ ...prev, image: e.target.files?.[0] || null }))}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setColorwayDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="bg-green-700 hover:bg-green-800" onClick={handleSaveColorway} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add colorway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOnlineStoreHeroes;
