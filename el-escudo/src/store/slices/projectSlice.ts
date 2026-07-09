import { apiDelete, apiPost, apiPut } from '../../api/requests';
import { Project, Task, Goal } from '../types';

export interface ProjectSlice {
  projects: {
    tareasHoy: { done: number; total: number };
    list: Project[];
    tasks: Task[];
  };
  goals: Goal[];

  createTask: (payload: { name: string; description?: string; category?: string; xp_reward?: number; status?: string; priority?: 'high' | 'medium' | 'low'; scheduledAt?: string }) => Promise<void>;
  updateTask: (taskId: string, updates: { name?: string; description?: string; category?: string; xp_reward?: number; status?: string; priority?: 'high' | 'medium' | 'low'; scheduledAt?: string }) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  rescheduleTask: (taskId: string, scheduledAt: string) => Promise<void>;
  changeTaskPriority: (taskId: string, priority: 'high' | 'medium' | 'low') => Promise<void>;
  addGoal: (goal: Omit<Goal, 'id' | 'current_value'>) => void;
  updateGoalProgress: (goalId: string, value: number) => void;
  updateGoal: (goalId: string, updates: Partial<Goal>) => void;
  completeGoal: (goalId: string) => void;
}

const genId = () => Math.random().toString(36).substring(7);

export const createProjectSlice = (set: any, get: any): ProjectSlice => ({
  projects: {
    tareasHoy: { done: 0, total: 0 },
    list: [],
    tasks: [],
  },
  goals: [],

  createTask: async (payload: { name: string; description?: string; category?: string; xp_reward?: number; status?: string; priority?: 'high' | 'medium' | 'low'; scheduledAt?: string }) => {
    const session = get().session;
    if (!session) return;
    try {
      const tempId = genId();
      const nextProject: Project = {
        id: tempId,
        name: payload.name,
        description: payload.description || '',
        category: payload.category || 'general',
        status: (payload.status === 'completed' ? 'completed' : 'active') as 'active' | 'completed',
        priority: payload.priority || 'medium',
        scheduledAt: payload.scheduledAt || undefined,
      };
      const nextTask: Task = {
        id: tempId,
        projectId: tempId,
        title: payload.name,
        priority: payload.priority || 'medium',
        completed: payload.status === 'completed',
        xpReward: typeof payload.xp_reward === 'number' ? payload.xp_reward : 50,
        scheduledAt: payload.scheduledAt || undefined,
      };
      set((state: any) => ({
        projects: {
          ...state.projects,
          list: [nextProject, ...state.projects.list],
          tasks: [nextTask, ...state.projects.tasks],
          tareasHoy: {
            ...state.projects.tareasHoy,
            total: state.projects.tareasHoy.total + 1,
            done: state.projects.tareasHoy.done + (nextTask.completed ? 1 : 0),
          },
        },
      }));
      get().markDataDirty('projects');

      const res = await apiPost('/api/v1/missions', {
        name: payload.name,
        description: payload.description || '',
        category: payload.category || 'general',
        xp_reward: typeof payload.xp_reward === 'number' ? payload.xp_reward : 50,
        status: payload.status || 'active',
        priority: payload.priority || 'medium',
        scheduled_at: payload.scheduledAt || null,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail || `Error del servidor (${res.status})`);
      }
      get().addLog({ text: 'Tarea creada y sincronizada.', category: 'SISTEMA' });
    } catch (e: any) {
      console.error('createTask error:', e);
      get().addLog({ text: `Error al crear tarea: ${e?.message || 'desconocido'}`, category: 'ERROR' });
    }
  },

  updateTask: async (taskId: string, updates: { name?: string; description?: string; category?: string; xp_reward?: number; status?: string; priority?: 'high' | 'medium' | 'low'; scheduledAt?: string }) => {
    const session = get().session;
    if (!session) return;
    try {
      set((state: any) => ({
        projects: {
          ...state.projects,
          list: state.projects.list.map((project: Project) =>
            project.id === taskId
              ? {
                  ...project,
                  name: updates.name ?? project.name,
                  description: updates.description ?? project.description,
                  category: updates.category ?? project.category,
                  status: (updates.status === 'completed' ? 'completed' : project.status) as 'active' | 'completed',
                  priority: updates.priority ?? project.priority,
                  scheduledAt: typeof updates.scheduledAt !== 'undefined' ? updates.scheduledAt : project.scheduledAt,
                }
              : project
          ),
          tasks: state.projects.tasks.map((task: Task) =>
            task.id === taskId
              ? {
                  ...task,
                  title: updates.name ?? task.title,
                  priority: updates.priority ?? task.priority,
                  completed: updates.status === 'completed' ? true : task.completed,
                  xpReward: typeof updates.xp_reward !== 'undefined' ? updates.xp_reward : task.xpReward,
                  scheduledAt: typeof updates.scheduledAt !== 'undefined' ? updates.scheduledAt : task.scheduledAt,
                }
              : task
          ),
        },
      }));
      get().markDataDirty('projects');

      const payload: Record<string, unknown> = {};
      if (typeof updates.name !== 'undefined') payload.name = updates.name;
      if (typeof updates.description !== 'undefined') payload.description = updates.description;
      if (typeof updates.category !== 'undefined') payload.category = updates.category;
      if (typeof updates.xp_reward !== 'undefined') payload.xp_reward = updates.xp_reward;
      if (typeof updates.status !== 'undefined') payload.status = updates.status;
      if (typeof updates.priority !== 'undefined') payload.priority = updates.priority;
      if (typeof updates.scheduledAt !== 'undefined') payload.scheduled_at = updates.scheduledAt;
      const res = await apiPut(`/api/v1/missions/${taskId}`, payload);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail || `Error del servidor (${res.status})`);
      }
      get().addLog({ text: 'Tarea actualizada y sincronizada.', category: 'SISTEMA' });
    } catch (e: any) {
      console.error('updateTask error:', e);
      get().addLog({ text: `Error al actualizar tarea: ${e?.message || 'desconocido'}`, category: 'ERROR' });
    }
  },

  completeTask: async (taskId: string) => {
    const session = get().session;
    if (!session) return;
    let achievementData = null;
    try {
      const res = await apiPut(`/api/v1/missions/${taskId}`, { status: 'completed' });
      if (res.ok) {
        const data = await res.json();
        if (data.achievement || data.new_achievement) {
          const ach = data.achievement || data.new_achievement;
          achievementData = {
            visible: true,
            name: ach.name || 'Logro Desbloqueado',
            description: ach.description || '',
          };
        }
      }
    } catch (e) {
      console.error(e);
    }

    set((state: any) => {
      const taskIndex = state.projects.tasks.findIndex((t: Task) => t.id === taskId);
      if (taskIndex === -1 || state.projects.tasks[taskIndex].completed) return state;
      const newTasks = [...state.projects.tasks];
      const completedTask = { ...newTasks[taskIndex], completed: true };
      newTasks[taskIndex] = completedTask;
      const projectId = newTasks[taskIndex].projectId;
      const projectTasks = newTasks.filter((t: Task) => t.projectId === projectId);
      const allCompleted = projectTasks.length > 0 && projectTasks.every((t: Task) => t.completed);
      const newProjectsList = [...state.projects.list];
      if (allCompleted) {
        const projIndex = newProjectsList.findIndex((p: Project) => p.id === projectId);
        if (projIndex !== -1) newProjectsList[projIndex] = { ...newProjectsList[projIndex], status: 'completed' };
      }
      setTimeout(() => {
        set({ missionCompleted: { visible: false, missionName: '', xpReward: 0 } });
      }, 3000);
      if (achievementData) {
        setTimeout(() => {
          set({ achievementUnlocked: { visible: false, name: '', description: '' } });
        }, 3500);
      }
      return {
        projects: {
          ...state.projects,
          tasks: newTasks,
          list: newProjectsList,
          tareasHoy: { ...state.projects.tareasHoy, done: state.projects.tareasHoy.done + 1 },
        },
        missionCompleted: {
          visible: true,
          missionName: completedTask.title || 'Misión',
          xpReward: completedTask.xpReward || 0,
        },
        achievementUnlocked: achievementData || state.achievementUnlocked,
      };
    });
    get().markDataDirty('projects');
  },

  deleteTask: async (taskId: string) => {
    const session = get().session;
    if (!session) return;
    try {
      set((state: any) => {
        const taskToDelete = state.projects.tasks.find((task: Task) => task.id === taskId);
        const nextTasks = state.projects.tasks.filter((task: Task) => task.id !== taskId);
        const nextProjects = state.projects.list.filter((project: Project) => project.id !== taskId);
        return {
          projects: {
            ...state.projects,
            list: nextProjects,
            tasks: nextTasks,
            tareasHoy: {
              ...state.projects.tareasHoy,
              total: Math.max(0, state.projects.tareasHoy.total - 1),
              done: Math.max(0, state.projects.tareasHoy.done - (taskToDelete?.completed ? 1 : 0)),
            },
          },
        };
      });
      get().markDataDirty('projects');

      const res = await apiDelete(`/api/v1/missions/${taskId}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail || `Error del servidor (${res.status})`);
      }
      get().addLog({ text: 'Tarea eliminada y sincronizada.', category: 'SISTEMA' });
    } catch (e: any) {
      console.error('deleteTask error:', e);
      get().addLog({ text: `Error al eliminar tarea: ${e?.message || 'desconocido'}`, category: 'ERROR' });
    }
  },

  rescheduleTask: async (taskId: string, scheduledAt: string) => {
    const session = get().session;
    if (!session) return;
    try {
      set((state: any) => ({
        projects: {
          ...state.projects,
          list: state.projects.list.map((project: Project) =>
            project.id === taskId ? { ...project, scheduledAt } : project
          ),
          tasks: state.projects.tasks.map((task: Task) =>
            task.id === taskId ? { ...task, scheduledAt } : task
          ),
        },
      }));
      get().markDataDirty('projects');

      const res = await apiPut(`/api/v1/missions/${taskId}`, { scheduled_at: scheduledAt });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail || `Error del servidor (${res.status})`);
      }
      get().addLog({ text: `Tarea reprogramada para ${scheduledAt}.`, category: 'SISTEMA' });
    } catch (e: any) {
      console.error('rescheduleTask error:', e);
      get().addLog({ text: `Error al reprogramar tarea: ${e?.message || 'desconocido'}`, category: 'ERROR' });
    }
  },

  changeTaskPriority: async (taskId: string, priority: 'high' | 'medium' | 'low') => {
    const session = get().session;
    if (!session) return;
    try {
      set((state: any) => ({
        projects: {
          ...state.projects,
          list: state.projects.list.map((project: Project) =>
            project.id === taskId ? { ...project, priority } : project
          ),
          tasks: state.projects.tasks.map((task: Task) =>
            task.id === taskId ? { ...task, priority } : task
          ),
        },
      }));
      get().markDataDirty('projects');

      const res = await apiPut(`/api/v1/missions/${taskId}`, { priority });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail || `Error del servidor (${res.status})`);
      }
      get().addLog({ text: `Prioridad actualizada a ${priority}.`, category: 'SISTEMA' });
    } catch (e: any) {
      console.error('changeTaskPriority error:', e);
      get().addLog({ text: `Error al cambiar prioridad: ${e?.message || 'desconocido'}`, category: 'ERROR' });
    }
  },

  addGoal: (goal: Omit<Goal, 'id' | 'current_value'>) => {
    set((state: any) => ({
      goals: [...state.goals, { ...goal, id: genId(), current_value: 0 }],
    }));
    get().addLog({ text: `Nueva meta creada: ${goal.name}`, category: 'SISTEMA' });
    get().addXP(100);
    get().markDataDirty('goals');
  },

  updateGoalProgress: (goalId: string, value: number) => {
    set((state: any) => ({
      goals: state.goals.map((g: Goal) =>
        g.id === goalId ? { ...g, current_value: value, status: value >= g.target_value ? 'completed' : g.status } : g
      ),
    }));
    get().markDataDirty('goals');
  },

  updateGoal: (goalId: string, updates: Partial<Goal>) => {
    set((state: any) => ({
      goals: state.goals.map((g: Goal) => {
        if (g.id !== goalId) return g;
        const nextCurrentValue = typeof updates.current_value === 'number' ? updates.current_value : g.current_value;
        const nextStatus = updates.status ?? (nextCurrentValue >= g.target_value ? 'completed' : g.status);
        return {
          ...g,
          ...updates,
          current_value: nextCurrentValue,
          status: nextStatus,
        };
      }),
    }));
    get().addLog({ text: 'Meta actualizada desde el chat.', category: 'SISTEMA' });
    get().markDataDirty('goals');
  },

  completeGoal: (goalId: string) => {
    set((state: any) => ({
      goals: state.goals.map((g: Goal) =>
        g.id === goalId ? { ...g, status: 'completed' as const, current_value: g.target_value } : g
      ),
    }));
    get().addLog({ text: 'META COMPLETADA. Blindaje aumentado.', category: 'SISTEMA' });
    get().addXP(500);
    get().markDataDirty('goals');
  },
});
