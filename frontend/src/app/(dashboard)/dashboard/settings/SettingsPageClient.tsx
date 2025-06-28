'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Clock,
  Camera,
  FileText,
  Globe,
  Zap,
  Shield,
  Bell,
  Download,
  Monitor,
  Smartphone,
  Settings2,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'weblink-studio-preferences';

type SettingsState = {
  // Default Request Settings
  defaultWaitTime: number;
  defaultTimeout: number;

  // Screenshot Defaults
  defaultScreenshotFormat: 'png' | 'jpeg' | 'webp';
  defaultQuality: number;
  defaultViewportWidth: number;
  defaultViewportHeight: number;
  defaultMobileMode: boolean;
  defaultFullPage: boolean;

  // Content Extraction
  defaultMarkdownMode: boolean;
  onlyMainContent: boolean;
  includeMetadata: boolean;
  preserveFormatting: boolean;

  // Link Extraction
  includeExternalLinks: boolean;
  visibleLinksOnly: boolean;

  // Search Settings
  defaultSearchLimit: number;
  preferredSearchEngine: 'duckduckgo' | 'startpage' | 'bing';

  // Performance & Limits
  concurrentRequests: number;
  enableCaching: boolean;
  cacheTimeout: number;

  // Privacy & Security
  enableRequestLogging: boolean;
  logRetentionDays: number;
  allowCORS: boolean;

  // Notifications
  creditAlerts: boolean;
  creditThreshold: number;
  rateLimitAlerts: boolean;
  failedRequestAlerts: boolean;

  // PDF Settings
  defaultPdfFormat: 'A4' | 'Letter' | 'Legal';
  includePdfMetadata: boolean;
};

const DEFAULT_SETTINGS: SettingsState = {
  // Default Request Settings
  defaultWaitTime: 2000,
  defaultTimeout: 30000,

  // Screenshot Defaults
  defaultScreenshotFormat: 'png',
  defaultQuality: 80,
  defaultViewportWidth: 1920,
  defaultViewportHeight: 1080,
  defaultMobileMode: false,
  defaultFullPage: true,

  // Content Extraction
  defaultMarkdownMode: true,
  onlyMainContent: false,
  includeMetadata: true,
  preserveFormatting: true,

  // Link Extraction
  includeExternalLinks: true,
  visibleLinksOnly: false,

  // Search Settings
  defaultSearchLimit: 15,
  preferredSearchEngine: 'duckduckgo',

  // Performance & Limits
  concurrentRequests: 5,
  enableCaching: true,
  cacheTimeout: 300,

  // Privacy & Security
  enableRequestLogging: true,
  logRetentionDays: 30,
  allowCORS: false,

  // Notifications
  creditAlerts: true,
  creditThreshold: 100,
  rateLimitAlerts: true,
  failedRequestAlerts: true,

  // PDF Settings
  defaultPdfFormat: 'A4',
  includePdfMetadata: true,
};

// Utility functions for localStorage operations
const loadSettingsFromStorage = (): SettingsState => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle any missing properties
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load settings from localStorage:', error);
  }

  return DEFAULT_SETTINGS;
};

const saveSettingsToStorage = (settings: SettingsState): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error);
  }
};

// Export function for studio integration
export const getStudioDefaults = () => {
  const settings = loadSettingsFromStorage();

  return {
    waitTime: settings.defaultWaitTime,
    format: settings.defaultScreenshotFormat,
    quality: settings.defaultQuality,
    width: settings.defaultViewportWidth,
    height: settings.defaultViewportHeight,
    mobile: settings.defaultMobileMode,
    fullPage: settings.defaultFullPage,
    limit: settings.defaultSearchLimit,
    onlyMainContent: settings.onlyMainContent, // Fixed: Use correct onlyMainContent setting
    includeExternal: settings.includeExternalLinks,
    visibleLinksOnly: settings.visibleLinksOnly,
  };
};

export default function SettingsPageClient() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadedSettings = loadSettingsFromStorage();
    setSettings(loadedSettings);

    // Check if there are any saved settings
    if (typeof window !== 'undefined' && localStorage.getItem(SETTINGS_STORAGE_KEY)) {
      setLastSaved(new Date()); // Indicate that settings exist
    }
  }, []);

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Save to localStorage
      saveSettingsToStorage(settings);
      setLastSaved(new Date());

      // Small delay for UX feedback
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }
    setLastSaved(null);
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Settings2 className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-lg lg:text-2xl font-medium text-foreground">Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Configure default parameters for your web scraping operations. These preferences will automatically apply in
          the Studio interface.
        </p>
        {lastSaved && (
          <Badge variant="outline" className="mt-3">
            <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
            Preferences saved locally
          </Badge>
        )}
      </div>

      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Requests</span>
          </TabsTrigger>
          <TabsTrigger value="visual" className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Visual</span>
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Content</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Performance</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alerts</span>
          </TabsTrigger>
        </TabsList>

        {/* Request Defaults */}
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Default Request Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Default Wait Time</Label>
                  <div className="space-y-3">
                    <Slider
                      value={[settings.defaultWaitTime]}
                      onValueChange={(value) => updateSetting('defaultWaitTime', value[0])}
                      max={10000}
                      min={0}
                      step={500}
                      className="w-full"
                    />
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>0ms</span>
                      <Badge variant="secondary" className="text-xs">
                        {settings.defaultWaitTime}ms
                      </Badge>
                      <span>10s</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Time to wait after page load before capturing content</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Request Timeout</Label>
                  <div className="space-y-3">
                    <Slider
                      value={[settings.defaultTimeout]}
                      onValueChange={(value) => updateSetting('defaultTimeout', value[0])}
                      max={120000}
                      min={5000}
                      step={5000}
                      className="w-full"
                    />
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>5s</span>
                      <Badge variant="secondary" className="text-xs">
                        {settings.defaultTimeout / 1000}s
                      </Badge>
                      <span>120s</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Maximum time to wait for a single request to complete</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visual Content */}
        <TabsContent value="visual">
          <div className="space-y-6">
            {/* Screenshot Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Screenshot Defaults
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Image Format</Label>
                    <Select
                      value={settings.defaultScreenshotFormat}
                      onValueChange={(value: 'png' | 'jpeg' | 'webp') =>
                        updateSetting('defaultScreenshotFormat', value)
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="png">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                            PNG (Best Quality)
                          </div>
                        </SelectItem>
                        <SelectItem value="jpeg">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-orange-500 rounded-full" />
                            JPEG (Smaller Size)
                          </div>
                        </SelectItem>
                        <SelectItem value="webp">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            WebP (Best Compression)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Quality
                      <Badge variant="outline" className="ml-2 text-xs">
                        {settings.defaultQuality}%
                      </Badge>
                    </Label>
                    <Slider
                      value={[settings.defaultQuality]}
                      onValueChange={(value) => updateSetting('defaultQuality', value[0])}
                      max={100}
                      min={10}
                      step={10}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>10%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Device Mode</Label>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Desktop</span>
                      </div>
                      <Switch
                        checked={settings.defaultMobileMode}
                        onCheckedChange={(checked) => updateSetting('defaultMobileMode', checked)}
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Mobile</span>
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Viewport Width (px)</Label>
                    <Input
                      type="number"
                      value={settings.defaultViewportWidth}
                      onChange={(e) => updateSetting('defaultViewportWidth', parseInt(e.target.value))}
                      min={320}
                      max={3840}
                      disabled={settings.defaultMobileMode}
                      className="h-9 text-base"
                    />
                    <p className="text-xs text-muted-foreground">
                      {settings.defaultMobileMode ? 'Controlled by mobile preset' : '320px - 3840px'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Viewport Height (px)</Label>
                    <Input
                      type="number"
                      value={settings.defaultViewportHeight}
                      onChange={(e) => updateSetting('defaultViewportHeight', parseInt(e.target.value))}
                      min={240}
                      max={2160}
                      disabled={settings.defaultMobileMode}
                      className="h-9 text-base"
                    />
                    <p className="text-xs text-muted-foreground">
                      {settings.defaultMobileMode ? 'Controlled by mobile preset' : '240px - 2160px'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Capture Options</Label>
                    <div className="flex items-center space-x-2 p-3 border rounded-lg">
                      <Switch
                        checked={settings.defaultFullPage}
                        onCheckedChange={(checked) => updateSetting('defaultFullPage', checked)}
                      />
                      <Label className="text-sm cursor-pointer">Full Page Capture</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">Capture entire page height vs viewport only</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PDF Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  PDF Generation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Default Page Format</Label>
                    <Select
                      value={settings.defaultPdfFormat}
                      onValueChange={(value: 'A4' | 'Letter' | 'Legal') => updateSetting('defaultPdfFormat', value)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A4">A4 (210×297mm)</SelectItem>
                        <SelectItem value="Letter">Letter (8.5×11in)</SelectItem>
                        <SelectItem value="Legal">Legal (8.5×14in)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Metadata Options</Label>
                    <div className="flex items-center space-x-2 p-3 border rounded-lg">
                      <Switch
                        checked={settings.includePdfMetadata}
                        onCheckedChange={(checked) => updateSetting('includePdfMetadata', checked)}
                      />
                      <Label className="text-sm cursor-pointer">Include PDF Metadata</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">Embed title, author, and creation date</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Content Extraction */}
        <TabsContent value="content">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Content & Links
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Content Preferences
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center space-x-2 p-3 border rounded-lg">
                      <Switch
                        checked={settings.defaultMarkdownMode}
                        onCheckedChange={(checked) => updateSetting('defaultMarkdownMode', checked)}
                      />
                      <Label className="text-sm cursor-pointer">Prefer Markdown</Label>
                    </div>

                    <div className="flex items-center space-x-2 p-3 border rounded-lg">
                      <Switch
                        checked={settings.onlyMainContent}
                        onCheckedChange={(checked) => updateSetting('onlyMainContent', checked)}
                      />
                      <Label className="text-sm cursor-pointer">Only Main Content</Label>
                    </div>

                    <div className="flex items-center space-x-2 p-3 border rounded-lg">
                      <Switch
                        checked={settings.includeMetadata}
                        onCheckedChange={(checked) => updateSetting('includeMetadata', checked)}
                      />
                      <Label className="text-sm cursor-pointer">Include Metadata</Label>
                    </div>

                    <div className="flex items-center space-x-2 p-3 border rounded-lg">
                      <Switch
                        checked={settings.preserveFormatting}
                        onCheckedChange={(checked) => updateSetting('preserveFormatting', checked)}
                      />
                      <Label className="text-sm cursor-pointer">Preserve Formatting</Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Link Extraction</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2 p-3 border rounded-lg">
                      <Switch
                        checked={settings.includeExternalLinks}
                        onCheckedChange={(checked) => updateSetting('includeExternalLinks', checked)}
                      />
                      <Label className="text-sm cursor-pointer">Include External Links</Label>
                    </div>

                    <div className="flex items-center space-x-2 p-3 border rounded-lg">
                      <Switch
                        checked={settings.visibleLinksOnly}
                        onCheckedChange={(checked) => updateSetting('visibleLinksOnly', checked)}
                      />
                      <Label className="text-sm cursor-pointer">Visible Links Only</Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Web Search</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">
                        Default Result Limit
                        <Badge variant="outline" className="ml-2 text-xs">
                          {settings.defaultSearchLimit} results
                        </Badge>
                      </Label>
                      <Slider
                        value={[settings.defaultSearchLimit]}
                        onValueChange={(value) => updateSetting('defaultSearchLimit', value[0])}
                        max={50}
                        min={5}
                        step={5}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>5 (Quick)</span>
                        <span>50 (Comprehensive)</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Preferred Search Engine</Label>
                      <Select
                        value={settings.preferredSearchEngine}
                        onValueChange={(value: 'duckduckgo' | 'startpage' | 'bing') =>
                          updateSetting('preferredSearchEngine', value)
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="duckduckgo">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-orange-500 rounded-full" />
                              DuckDuckGo
                            </div>
                          </SelectItem>
                          <SelectItem value="startpage">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full" />
                              Startpage
                            </div>
                          </SelectItem>
                          <SelectItem value="bing">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full" />
                              Bing
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Performance & Caching
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Concurrent Requests
                      <Badge variant="outline" className="ml-2 text-xs">
                        {settings.concurrentRequests} parallel
                      </Badge>
                    </Label>
                    <Slider
                      value={[settings.concurrentRequests]}
                      onValueChange={(value) => updateSetting('concurrentRequests', value[0])}
                      max={10}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1 (Conservative)</span>
                      <span>10 (Aggressive)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Number of simultaneous scraping operations</p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Cache Timeout
                      <Badge variant="outline" className="ml-2 text-xs">
                        {Math.floor(settings.cacheTimeout / 60)}m
                      </Badge>
                    </Label>
                    <Slider
                      value={[settings.cacheTimeout]}
                      onValueChange={(value) => updateSetting('cacheTimeout', value[0])}
                      max={3600}
                      min={60}
                      step={60}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1min (Fresh)</span>
                      <span>60min (Persistent)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">How long to cache scraping results</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/30">
                  <Switch
                    checked={settings.enableCaching}
                    onCheckedChange={(checked) => updateSetting('enableCaching', checked)}
                  />
                  <div className="flex-1">
                    <Label className="text-sm font-medium cursor-pointer">Enable Response Caching</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cache responses to improve performance and reduce API costs
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy & Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2 p-4 border rounded-lg">
                  <Switch
                    checked={settings.enableRequestLogging}
                    onCheckedChange={(checked) => updateSetting('enableRequestLogging', checked)}
                  />
                  <div className="flex-1">
                    <Label className="text-sm font-medium cursor-pointer">Enable Request Logging</Label>
                    <p className="text-xs text-muted-foreground mt-1">Log API requests for debugging and analytics</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Log Retention Period
                    <Badge variant="outline" className="ml-2 text-xs">
                      {settings.logRetentionDays} days
                    </Badge>
                  </Label>
                  <Slider
                    value={[settings.logRetentionDays]}
                    onValueChange={(value) => updateSetting('logRetentionDays', value[0])}
                    max={90}
                    min={7}
                    step={7}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>7 days (Minimal)</span>
                    <span>90 days (Extended)</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 p-4 border rounded-lg border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <Switch
                    checked={settings.allowCORS}
                    onCheckedChange={(checked) => updateSetting('allowCORS', checked)}
                  />
                  <div className="flex-1">
                    <Label className="text-sm font-medium cursor-pointer">Allow Cross-Origin Requests</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enable CORS for client-side API calls (security consideration)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Alerts & Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/30">
                  <Switch
                    checked={settings.creditAlerts}
                    onCheckedChange={(checked) => updateSetting('creditAlerts', checked)}
                  />
                  <div className="flex-1">
                    <Label className="text-sm font-medium cursor-pointer">Credit Usage Alerts</Label>
                    <p className="text-xs text-muted-foreground mt-1">Get notified when your credit balance runs low</p>
                  </div>
                </div>

                {settings.creditAlerts && (
                  <div className="ml-6 space-y-3 p-4 border-l-2 border-primary bg-muted/20 rounded-r-lg">
                    <Label className="text-sm font-medium">
                      Alert Threshold
                      <Badge variant="outline" className="ml-2 text-xs">
                        {settings.creditThreshold} credits
                      </Badge>
                    </Label>
                    <Slider
                      value={[settings.creditThreshold]}
                      onValueChange={(value) => updateSetting('creditThreshold', value[0])}
                      max={1000}
                      min={10}
                      step={10}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>10 (Critical)</span>
                      <span>1000 (Conservative)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Alert when credits drop below this threshold</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2 p-4 border rounded-lg">
                    <Switch
                      checked={settings.rateLimitAlerts}
                      onCheckedChange={(checked) => updateSetting('rateLimitAlerts', checked)}
                    />
                    <div className="flex-1">
                      <Label className="text-sm font-medium cursor-pointer">Rate Limit Notifications</Label>
                      <p className="text-xs text-muted-foreground mt-1">Alert when hitting API rate limits</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 p-4 border rounded-lg">
                    <Switch
                      checked={settings.failedRequestAlerts}
                      onCheckedChange={(checked) => updateSetting('failedRequestAlerts', checked)}
                    />
                    <div className="flex-1">
                      <Label className="text-sm font-medium cursor-pointer">Failed Request Alerts</Label>
                      <p className="text-xs text-muted-foreground mt-1">Notify on scraping failures</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {lastSaved && 'Preferences saved locally and will apply in Studio'}
          </div>
          <Button variant="outline" onClick={handleReset} className="text-sm h-9">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Defaults
          </Button>
        </div>
        <Button onClick={handleSave} disabled={isLoading} className="h-9">
          {isLoading ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </section>
  );
}
