import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { dispatch } from "@designcombo/events";
import { HISTORY_UNDO, HISTORY_REDO, DESIGN_RESIZE } from "@designcombo/state";
import { Icons } from "@/components/shared/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import {
  ChevronDown,
  Keyboard,
  ProportionsIcon,
  Loader2,
  Save
} from "lucide-react";
import { Label } from "@/components/ui/label";

import type StateManager from "@designcombo/state";
import { generateId } from "@designcombo/timeline";
import type { IDesign } from "@designcombo/types";
import { useDownloadState } from "./store/use-download-state";
import DownloadProgressModal from "./download-progress-modal";
import AutosizeInput from "@/components/ui/autosize-input";
import { debounce } from "lodash";
import {
  useIsLargeScreen,
  useIsMediumScreen,
  useIsSmallScreen
} from "@/hooks/use-media-query";

import { LogoIcons } from "@/components/shared/logos";
import { ShortcutsModal } from "./shortcuts-modal";
import { ModeToggle } from "@/components/ui/mode-toggle";
import useStore from "./store/use-store";

export default function Navbar({
  user,
  stateManager,
  setProjectName,
  projectName
}: {
  user: any | null;
  stateManager: StateManager;
  setProjectName: (name: string) => void;
  projectName: string;
}) {
  const [title, setTitle] = useState(projectName);
  const isLargeScreen = useIsLargeScreen();
  const isMediumScreen = useIsMediumScreen();
  const isSmallScreen = useIsSmallScreen();
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { projectId } = useStore();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const homeUrl = typeof window !== "undefined" ? window.location.origin.replace("3001", "3000") : "http://localhost:3000";

  const handleUndo = () => {
    dispatch(HISTORY_UNDO);
  };

  const handleRedo = () => {
    dispatch(HISTORY_REDO);
  };

  const handleSaveProject = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const state = stateManager.toJSON();
      const trackItemsMap = state.trackItemsMap;

      // 1. Save title if it has changed
      if (title !== projectName) {
        await fetch(`${apiBaseUrl}/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        setProjectName(title);
      }

      // 2. Find all caption items and save script updates
      const captionItems = Object.values(trackItemsMap).filter((item: any) => item.type === "caption");
      for (const item of captionItems) {
        const sceneId = item.id.replace("caption-", "");
        if (sceneId && item.details?.text) {
          await fetch(`${apiBaseUrl}/projects/${projectId}/scenes/${sceneId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ script: item.details.text }),
          });
        }
      }

      // 3. Find all visual items and save asset associations
      const visualItems = Object.values(trackItemsMap).filter((item: any) => item.type === "video" || item.type === "image");
      for (const item of visualItems) {
        const sceneId = item.id.replace("visual-", "");
        if (sceneId && item.details?.src) {
          const srcUrl = item.details.src;
          let assetPath = srcUrl;
          
          if (srcUrl.includes("/assets/")) {
            assetPath = "assets/" + srcUrl.split("/assets/")[1];
          } else if (srcUrl.startsWith(apiBaseUrl)) {
            assetPath = srcUrl.replace(`${apiBaseUrl}/`, "");
          }

          const assetsRes = await fetch(`${apiBaseUrl}/projects/${projectId}/assets`);
          if (assetsRes.ok) {
            const { assets } = await assetsRes.json();
            const matchedAsset = assets.find((a: any) => a.path === assetPath);
            if (matchedAsset) {
              await fetch(`${apiBaseUrl}/projects/${projectId}/scenes/${sceneId}/asset`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assetId: matchedAsset.id }),
              });
            }
          }
        }
      }

      alert("Projeto salvo com sucesso!");
    } catch (err) {
      console.error("Failed to save project:", err);
      alert("Erro ao salvar o projeto.");
    } finally {
      setSaving(false);
    }
  };

  // Create a debounced function for setting the project name
  const debouncedSetProjectName = useCallback(
    debounce((name: string) => {
      console.log("Debounced setProjectName:", name);
      setProjectName(name);
    }, 2000), // 2 seconds delay
    []
  );

  // Update the debounced function whenever the title changes
  useEffect(() => {
    debouncedSetProjectName(title);
  }, [title, debouncedSetProjectName]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isLargeScreen ? "320px 1fr 320px" : "1fr 1fr 1fr"
      }}
      className="bg-card pointer-events-none flex h-13 items-center border-b border-border/80 px-2"
    >
      <DownloadProgressModal />

      <div className="flex items-center gap-2">
        <a
          aria-label="Voltar para o Open Video Studio"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground"
          href={homeUrl}
        >
          <LogoIcons.scenify />
        </a>

        <div className=" pointer-events-auto flex h-10 items-center px-1.5">
          <Button
            onClick={handleUndo}
            className="text-muted-foreground"
            variant="ghost"
            size="icon"
          >
            <Icons.undo width={20} />
          </Button>
          <Button
            onClick={handleRedo}
            className="text-muted-foreground"
            variant="ghost"
            size="icon"
          >
            <Icons.redo width={20} />
          </Button>
        </div>
      </div>

      <div className="flex h-13 items-center justify-center gap-2">
        {!isSmallScreen && (
          <div className=" pointer-events-auto flex h-10 items-center gap-2 rounded-md px-2.5">
            <AutosizeInput
              name="title"
              value={title}
              onChange={handleTitleChange}
              width={200}
              inputClassName="border-none outline-none px-1 text-sm font-medium"
            />
          </div>
        )}
      </div>

      <div className="flex h-13 items-center justify-end gap-2">
        <div className=" pointer-events-auto flex h-10 items-center gap-2 rounded-md px-2.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setIsShortcutsModalOpen(true)}
          >
            <Keyboard className="size-5" />
          </Button>
          <ModeToggle />

          <Button
            onClick={handleSaveProject}
            disabled={saving}
            className="flex h-8 gap-1 bg-violet-600 hover:bg-violet-700 text-white rounded-full font-medium"
            size={isMediumScreen ? "sm" : "default"}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden md:block">Salvando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span className="hidden md:block">Salvar</span>
              </>
            )}
          </Button>

          <DownloadPopover stateManager={stateManager} />
        </div>
      </div>
      <ShortcutsModal
        open={isShortcutsModalOpen}
        onOpenChange={setIsShortcutsModalOpen}
      />
    </div>
  );
}

const DownloadPopover = ({ stateManager }: { stateManager: StateManager }) => {
  const isMediumScreen = useIsMediumScreen();
  const { actions, exportType } = useDownloadState();
  const [isExportTypeOpen, setIsExportTypeOpen] = useState(false);
  const [open, setOpen] = useState(false);

  const handleExport = () => {
    const data: IDesign = {
      id: generateId(),
      ...stateManager.toJSON()
    };

    console.log({ data });

    actions.setState({ payload: data });
    actions.startExport();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          className="flex h-8 gap-1 border border-border rounded-full"
          size={isMediumScreen ? "sm" : "icon"}
        >
          {/* <Download width={18} />{" "} */}
          <span className="hidden md:block">Exportar</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="bg-sidebar z-[250] flex w-60 flex-col gap-4"
      >
        <Label>Configurações de exportação</Label>

        <Popover open={isExportTypeOpen} onOpenChange={setIsExportTypeOpen}>
          <PopoverTrigger asChild>
            <Button className="w-full justify-between" variant="outline">
              <div>{exportType.toUpperCase()}</div>
              <ChevronDown width={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="bg-background z-[251] w-[--radix-popover-trigger-width] px-2 py-2">
            <div
              className="flex h-7 items-center rounded-sm px-3 text-sm hover:cursor-pointer hover:bg-zinc-800"
              onClick={() => {
                actions.setExportType("mp4");
                setIsExportTypeOpen(false);
              }}
            >
              MP4
            </div>
            <div
              className="flex h-7 items-center rounded-sm px-3 text-sm hover:cursor-pointer hover:bg-zinc-800"
              onClick={() => {
                actions.setExportType("json");
                setIsExportTypeOpen(false);
              }}
            >
              JSON
            </div>
          </PopoverContent>
        </Popover>

        <div>
          <Button onClick={handleExport} className="w-full">
            Exportar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface ResizeOptionProps {
  label: string;
  icon: string;
  value: ResizeValue;
  description: string;
}

interface ResizeValue {
  width: number;
  height: number;
  name: string;
}

const RESIZE_OPTIONS: ResizeOptionProps[] = [
  {
    label: "16:9",
    icon: "landscape",
    description: "YouTube horizontal",
    value: {
      width: 1920,
      height: 1080,
      name: "16:9"
    }
  },
  {
    label: "9:16",
    icon: "portrait",
    description: "Shorts, Reels e TikTok",
    value: {
      width: 1080,
      height: 1920,
      name: "9:16"
    }
  },
  {
    label: "1:1",
    icon: "square",
    description: "Feed quadrado",
    value: {
      width: 1080,
      height: 1080,
      name: "1:1"
    }
  }
];

const ResizeVideo = () => {
  const handleResize = (options: ResizeValue) => {
    dispatch(DESIGN_RESIZE, {
      payload: {
        ...options
      }
    });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="z-10 h-7 gap-2" variant="outline" size={"sm"}>
          <ProportionsIcon className="h-4 w-4" />
          <div>Formato</div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[250] w-60 px-2.5 py-3">
        <div className="text-sm">
          {RESIZE_OPTIONS.map((option, index) => (
            <ResizeOption
              key={index}
              label={option.label}
              icon={option.icon}
              value={option.value}
              handleResize={handleResize}
              description={option.description}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const ResizeOption = ({
  label,
  icon,
  value,
  description,
  handleResize
}: ResizeOptionProps & { handleResize: (payload: ResizeValue) => void }) => {
  const Icon = Icons[icon as "text"];
  return (
    <div
      onClick={() => handleResize(value)}
      className="flex cursor-pointer items-center rounded-md p-2 hover:bg-zinc-50/10"
    >
      <div className="w-8 text-muted-foreground">
        <Icon size={20} />
      </div>
      <div>
        <div>{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
};
