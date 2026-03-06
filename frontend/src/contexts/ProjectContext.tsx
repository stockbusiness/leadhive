import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import type { Project } from "../types";

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  setCurrentProjectId: (id: number) => void;
  refreshProjects: () => Promise<void>;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  currentProject: null,
  setCurrentProjectId: () => {},
  refreshProjects: async () => {},
  loading: true,
});

export function useProject() {
  return useContext(ProjectContext);
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectIdState] = useState<number>(() => {
    const saved = localStorage.getItem("escms_project_id");
    return saved ? Number(saved) : 0;
  });
  const [loading, setLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    try {
      const res = await axios.get<{ projects: Project[] }>("/api/projects");
      setProjects(res.data.projects);
      if (res.data.projects.length > 0 && !currentProjectId) {
        const firstId = res.data.projects[0].id;
        setCurrentProjectIdState(firstId);
        localStorage.setItem("escms_project_id", String(firstId));
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    refreshProjects();
  }, []);

  useEffect(() => {
    const interceptor = axios.interceptors.request.use((config) => {
      if (!currentProjectId) return config;

      const url = config.url || "";
      if (url.startsWith("/api/projects") || url.startsWith("/api/settings") || url.startsWith("/api/templates")) {
        return config;
      }

      if (config.method === "get" || config.method === "GET") {
        config.params = { ...config.params, project_id: currentProjectId };
      } else if (config.data && typeof config.data === "object" && !(config.data instanceof FormData)) {
        config.data = { ...config.data, project_id: currentProjectId };
      }
      return config;
    });

    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, [currentProjectId]);

  const setCurrentProjectId = useCallback((id: number) => {
    setCurrentProjectIdState(id);
    localStorage.setItem("escms_project_id", String(id));
  }, []);

  const currentProject = projects.find((p) => p.id === currentProjectId) || null;

  return (
    <ProjectContext.Provider
      value={{ projects, currentProject, setCurrentProjectId, refreshProjects, loading }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
