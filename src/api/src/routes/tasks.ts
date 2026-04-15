import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository } from "../models/baseRepository";
import { Task } from "../models/task";
import { getContainer } from "../models/cosmosClient";
import { validateTask } from "../validation";

// Tasks collection — daily tasks tracked during a shift.
export default createCrudRouter<Task>(
    () => new BaseRepository<Task>(getContainer("tasks")),
    "tasks",
    validateTask,
);
