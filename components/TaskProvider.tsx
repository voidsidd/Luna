"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { loadTasks, saveTask, updateTask } from "@/lib/storage/taskStore";
import { loadTaskEvents, recordTaskEvent } from "@/lib/storage/taskEventStore";
import type { Task, TaskEvent, TaskEventType, TaskStatus } from "@/lib/types";

interface TaskContextType {
  tasks: Task[];
  events: TaskEvent[];
  isLoaded: boolean;
  refreshData: () => void;
  upsertTask: (task: Task) => Promise<void>;
  setStatus: (task: Task, status: TaskStatus) => Promise<void>;
  logEvent: (task: Task, eventType: TaskEventType, metadata?: Record<string, unknown>) => Promise<void>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const refreshData = useCallback(() => {
    Promise.all([loadTasks(), loadTaskEvents()]).then(([taskItems, eventItems]) => {
      setTasks(taskItems);
      setEvents(eventItems);
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  async function upsertTask(task: Task) {
    const saved = await saveTask(task);
    setTasks((current) => {
      const exists = current.some((item) => item.id === saved.id);
      return exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current];
    });
  }

  async function setStatus(task: Task, status: TaskStatus) {
    const saved = await updateTask({ ...task, status, updatedAt: new Date().toISOString() });
    setTasks((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    await logEvent(saved, status === "done" ? "completed" : "edited");
  }

  async function logEvent(task: Task, eventType: TaskEventType, metadata: Record<string, unknown> = {}) {
    const savedEvent = await recordTaskEvent(task, eventType, metadata);
    setEvents((current) => [savedEvent, ...current]);
  }

  return (
    <TaskContext.Provider value={{ tasks, events, isLoaded, refreshData, upsertTask, setStatus, logEvent }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) throw new Error("useTasks must be used within a TaskProvider");
  return context;
}
