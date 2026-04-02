"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { VideoEditor } from "@/components/dashboard/VideoEditor";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Plus, Film, FolderOpen, CheckCircle } from "lucide-react";
import type { VideoProject, VideoScene } from "@/types/canvas";

export default function VideoEditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<VideoProject>({
    id: projectId,
    title: "Untitled Video",
    scenes: [],
    referenceImages: [],
    createdAt: new Date().toISOString(),
  });

  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project.title);
  const [toast, setToast] = useState<string | null>(null);

  // Import asset from Assets page via localStorage
  useEffect(() => {
    const importData = localStorage.getItem("pm-editor-import");
    if (importData) {
      localStorage.removeItem("pm-editor-import");
      try {
        const imported = JSON.parse(importData);
        const newScene: VideoScene = {
          id: crypto.randomUUID(),
          prompt: imported.prompt ?? "Imported asset",
          videoUrl: imported.type === "video" ? imported.url : undefined,
          sourceImageUrl: imported.type === "image" ? imported.url : undefined,
          duration: 5,
          trimStart: 0,
          trimEnd: 5,
          status: imported.type === "video" ? "ready" : "generating",
          mode: imported.type === "image" ? "i2v" : "t2v",
          referenceImageIds: [],
          versions: [],
        };
        setProject(prev => {
          const sceneNum = prev.scenes.length + 1;
          setToast(`${imported.type === "video" ? "Video" : "Image"} imported as Scene ${sceneNum}`);
          return {
            ...prev,
            title: imported.prompt?.slice(0, 40) ?? prev.title,
            scenes: [...prev.scenes, newScene],
          };
        });
      } catch { /* ignore corrupt data */ }
    }
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // TODO: Load project from database if it exists
  // useEffect(() => {
  //   fetch(`/api/video/project/${projectId}`)
  //     .then(res => res.json())
  //     .then(data => setProject(data))
  //     .catch(() => {});
  // }, [projectId]);

  function handleUpdateProject(updated: VideoProject) {
    setProject(updated);
    // TODO: Persist to database
  }

  function handleTitleSave() {
    setTitleEditing(false);
    setProject((prev) => ({ ...prev, title: titleDraft }));
  }

  function addEmptyScene() {
    const scene: VideoScene = {
      id: crypto.randomUUID(),
      prompt: "",
      duration: 5,
      trimStart: 0,
      trimEnd: 5,
      status: "ready",
      versions: [],
      mode: "t2v" as const,
      referenceImageIds: [],
    };
    setProject((prev) => ({
      ...prev,
      scenes: [...prev.scenes, scene],
    }));
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Video Editor"
        subtitle={project.title}
      />

      <div className="px-4 py-4 sm:px-6 sm:py-6">
        {/* Back + title */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="
              flex h-9 w-9 items-center justify-center rounded-lg
              text-ash hover:text-cloud hover:bg-slate
              transition-colors cursor-pointer
            "
          >
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>

          {titleEditing ? (
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
              className="
                bg-transparent text-lg font-semibold text-cloud
                border-b border-royal focus:outline-none
              "
              autoFocus
            />
          ) : (
            <h2
              onClick={() => {
                setTitleDraft(project.title);
                setTitleEditing(true);
              }}
              className="text-lg font-semibold text-cloud cursor-pointer hover:text-royal transition-colors"
            >
              {project.title}
            </h2>
          )}
        </div>

        {/* Editor */}
        {project.scenes.length > 0 ? (
          <VideoEditor
            project={project}
            onUpdateProject={handleUpdateProject}
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-smoke bg-graphite/50 py-16">
            <Film size={40} strokeWidth={1} className="mb-4 text-ash/40" />
            <p className="mb-1 text-sm font-medium text-cloud/80">
              No scenes yet
            </p>
            <p className="mb-6 text-xs text-ash">
              Add your first scene to start building your video
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={addEmptyScene}
                icon={<Plus size={14} strokeWidth={1.5} />}
              >
                Add First Scene
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push("/dashboard/assets")}
                icon={<FolderOpen size={14} strokeWidth={1.5} />}
              >
                Browse Assets
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg bg-royal/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          <CheckCircle size={16} strokeWidth={1.5} />
          {toast}
        </div>
      )}
    </div>
  );
}
