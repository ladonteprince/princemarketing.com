'use client';

// LockEndpointsPanel
// WHY: Interpolation mode requires two keyframes (first + last). This panel
// gives the user a focused, modal-style UI to lock both endpoints from any of
// four sources (upload, generate, asset library, previous scene's last frame)
// without polluting the main VideoEditor scene card.

import { useState } from 'react';
import {
  X,
  Upload,
  Sparkles,
  FolderOpen,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import type { VideoScene } from '@/types/canvas';

type UserAsset = {
  id: string;
  url: string;
  name: string;
  type: string;
};

export type LockEndpointsPanelProps = {
  scene: VideoScene;
  previousScene?: VideoScene;
  userAssets: UserAsset[];
  onUpdateScene: (updates: Partial<VideoScene>) => void;
  onClose: () => void;
};

type SlotKey = 'first' | 'last';
// WHY: each slot tracks which sub-menu (if any) is currently open so we can
// render upload/generate/assets pickers inline without a second modal layer.
type SlotMenu = null | 'menu' | 'generate' | 'assets';

export default function LockEndpointsPanel({
  scene,
  previousScene,
  userAssets,
  onUpdateScene,
  onClose,
}: LockEndpointsPanelProps) {
  // WHY: optimistic local state — we only commit to the parent scene on Save
  // so the user can back out without dirtying the canvas.
  const [firstFrameUrl, setFirstFrameUrl] = useState<string | undefined>(
    scene.firstFrameUrl,
  );
  const [lastFrameUrl, setLastFrameUrl] = useState<string | undefined>(
    scene.lastFrameUrl,
  );

  const [firstMenu, setFirstMenu] = useState<SlotMenu>(null);
  const [lastMenu, setLastMenu] = useState<SlotMenu>(null);

  const [loadingSlot, setLoadingSlot] = useState<SlotKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [generatePromptFirst, setGeneratePromptFirst] = useState('');
  const [generatePromptLast, setGeneratePromptLast] = useState('');

  const setUrl = (slot: SlotKey, url: string) => {
    if (slot === 'first') setFirstFrameUrl(url);
    else setLastFrameUrl(url);
  };

  const setMenu = (slot: SlotKey, menu: SlotMenu) => {
    if (slot === 'first') setFirstMenu(menu);
    else setLastMenu(menu);
  };

  // WHY: shared upload handler — POSTs to /api/upload/image and expects { url }.
  const handleUpload = async (slot: SlotKey, file: File) => {
    setError(null);
    setLoadingSlot(slot);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/image', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const data = (await res.json()) as { url: string };
      setUrl(slot, data.url);
      setMenu(slot, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setLoadingSlot(null);
    }
  };

  // WHY: text-to-image generation through Nano Banana via /api/generate/image.
  const handleGenerate = async (slot: SlotKey, prompt: string) => {
    if (!prompt.trim()) {
      setError('Enter a prompt to generate a frame');
      return;
    }
    setError(null);
    setLoadingSlot(slot);
    try {
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data = (await res.json()) as { url: string };
      setUrl(slot, data.url);
      setMenu(slot, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoadingSlot(null);
    }
  };

  // WHY: pulls the last frame from the previous scene's video. The
  // /api/video/extract-frame endpoint doesn't exist yet — we fall back to the
  // raw videoUrl placeholder so the UX is wired end-to-end. See TODO below.
  const handleUsePreviousLastFrame = async () => {
    if (!previousScene?.videoUrl) return;
    setError(null);
    setLoadingSlot('first');
    try {
      // TODO: wire up POST /api/video/extract-frame { videoUrl, position: 'last' }
      // and use the returned image URL once that endpoint ships.
      setFirstFrameUrl(previousScene.videoUrl);
      setFirstMenu(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not extract frame');
    } finally {
      setLoadingSlot(null);
    }
  };

  const canSave = Boolean(firstFrameUrl && lastFrameUrl);

  const handleSave = () => {
    if (!canSave) return;
    onUpdateScene({
      mode: 'interpolate',
      firstFrameUrl,
      lastFrameUrl,
    });
    onClose();
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-smoke bg-graphite shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-smoke px-4 py-3">
          <h3 className="text-sm font-semibold text-cloud">Lock Endpoints</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ash transition hover:bg-smoke hover:text-cloud"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cost notice */}
        <div className="px-4 pt-3">
          <p className="text-xs text-ash">
            +50% cost — interpolation between two keyframes for precision control
          </p>
        </div>

        {/* Slots */}
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <FrameSlot
            label="First Frame"
            slot="first"
            url={firstFrameUrl}
            menu={firstMenu}
            loading={loadingSlot === 'first'}
            generatePrompt={generatePromptFirst}
            setGeneratePrompt={setGeneratePromptFirst}
            userAssets={userAssets}
            showUsePrevious={Boolean(previousScene?.videoUrl)}
            onOpenMenu={() => setFirstMenu('menu')}
            onCloseMenu={() => setFirstMenu(null)}
            onSelectMenu={(m) => setFirstMenu(m)}
            onClear={() => setFirstFrameUrl(undefined)}
            onUpload={(file) => handleUpload('first', file)}
            onGenerate={(prompt) => handleGenerate('first', prompt)}
            onPickAsset={(url) => {
              setFirstFrameUrl(url);
              setFirstMenu(null);
            }}
            onUsePrevious={handleUsePreviousLastFrame}
          />

          <FrameSlot
            label="Last Frame"
            slot="last"
            url={lastFrameUrl}
            menu={lastMenu}
            loading={loadingSlot === 'last'}
            generatePrompt={generatePromptLast}
            setGeneratePrompt={setGeneratePromptLast}
            userAssets={userAssets}
            showUsePrevious={false}
            onOpenMenu={() => setLastMenu('menu')}
            onCloseMenu={() => setLastMenu(null)}
            onSelectMenu={(m) => setLastMenu(m)}
            onClear={() => setLastFrameUrl(undefined)}
            onUpload={(file) => handleUpload('last', file)}
            onGenerate={(prompt) => handleGenerate('last', prompt)}
            onPickAsset={(url) => {
              setLastFrameUrl(url);
              setLastMenu(null);
            }}
            onUsePrevious={() => {}}
          />
        </div>

        {error && (
          <div className="mx-4 mb-3 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-smoke px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-ash transition hover:bg-smoke hover:text-cloud"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-md bg-royal px-3 py-1.5 text-xs font-medium text-cloud transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save & Generate
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- FrameSlot ----------

type FrameSlotProps = {
  label: string;
  slot: SlotKey;
  url?: string;
  menu: SlotMenu;
  loading: boolean;
  generatePrompt: string;
  setGeneratePrompt: (p: string) => void;
  userAssets: UserAsset[];
  showUsePrevious: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onSelectMenu: (m: SlotMenu) => void;
  onClear: () => void;
  onUpload: (file: File) => void;
  onGenerate: (prompt: string) => void;
  onPickAsset: (url: string) => void;
  onUsePrevious: () => void;
};

function FrameSlot({
  label,
  url,
  menu,
  loading,
  generatePrompt,
  setGeneratePrompt,
  userAssets,
  showUsePrevious,
  onOpenMenu,
  onCloseMenu,
  onSelectMenu,
  onClear,
  onUpload,
  onGenerate,
  onPickAsset,
  onUsePrevious,
}: FrameSlotProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-ash">
          {label}
        </span>
        {url && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full p-0.5 text-ash transition hover:bg-smoke hover:text-cloud"
            aria-label={`Clear ${label}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-smoke bg-black/40">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
            <Loader2 className="h-5 w-5 animate-spin text-cloud" />
          </div>
        )}

        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            className="h-full w-full object-cover"
          />
        ) : menu === null ? (
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex h-full w-full items-center justify-center text-xs text-ash transition hover:bg-smoke/30 hover:text-cloud"
          >
            + Add frame
          </button>
        ) : menu === 'menu' ? (
          <div className="grid h-full w-full grid-cols-2 gap-1 p-1">
            <SlotOption
              icon={<Upload className="h-4 w-4" />}
              label="Upload"
              onClick={() => {
                // WHY: trigger a hidden file input via a synthetic element so
                // we don't need to render a persistent input per slot.
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = () => {
                  const file = input.files?.[0];
                  if (file) onUpload(file);
                };
                input.click();
              }}
            />
            <SlotOption
              icon={<Sparkles className="h-4 w-4" />}
              label="Generate"
              onClick={() => onSelectMenu('generate')}
            />
            <SlotOption
              icon={<FolderOpen className="h-4 w-4" />}
              label="Assets"
              onClick={() => onSelectMenu('assets')}
            />
            {showUsePrevious ? (
              <SlotOption
                icon={<ArrowLeft className="h-4 w-4" />}
                label="Prev frame"
                onClick={onUsePrevious}
              />
            ) : (
              <button
                type="button"
                onClick={onCloseMenu}
                className="rounded-md border border-smoke/50 bg-black/30 text-[10px] text-ash hover:bg-smoke/30"
              >
                Cancel
              </button>
            )}
          </div>
        ) : menu === 'generate' ? (
          <div className="flex h-full w-full flex-col gap-1 p-2">
            <textarea
              value={generatePrompt}
              onChange={(e) => setGeneratePrompt(e.target.value)}
              placeholder="Describe the frame…"
              className="flex-1 resize-none rounded-md border border-smoke bg-black/40 p-2 text-[11px] text-cloud placeholder:text-ash/60 focus:border-royal focus:outline-none"
            />
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={onCloseMenu}
                className="rounded-md px-2 py-0.5 text-[10px] text-ash hover:text-cloud"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => onGenerate(generatePrompt)}
                className="rounded-md bg-royal px-2 py-0.5 text-[10px] font-medium text-cloud hover:brightness-110"
              >
                Generate
              </button>
            </div>
          </div>
        ) : menu === 'assets' ? (
          <div className="flex h-full w-full flex-col p-1">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-[10px] uppercase tracking-wide text-ash">
                Pick asset
              </span>
              <button
                type="button"
                onClick={onCloseMenu}
                className="text-[10px] text-ash hover:text-cloud"
              >
                Back
              </button>
            </div>
            <div className="grid flex-1 grid-cols-3 gap-1 overflow-y-auto">
              {userAssets.length === 0 ? (
                <div className="col-span-3 flex items-center justify-center text-[10px] text-ash">
                  No assets yet
                </div>
              ) : (
                userAssets.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onPickAsset(a.url)}
                    className="aspect-video overflow-hidden rounded border border-smoke/60 hover:border-royal"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.url}
                      alt={a.name}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SlotOption({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 rounded-md border border-smoke/50 bg-black/30 text-[10px] text-cloud transition hover:border-royal hover:bg-smoke/30"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
