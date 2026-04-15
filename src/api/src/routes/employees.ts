import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository } from "../models/baseRepository";
import { Employee } from "../models/employee";
import { getContainer } from "../models/cosmosClient";
import { validateEmployee } from "../validation";

// Employees collection — stores shift roster profiles.
export default createCrudRouter<Employee>(
    () => new BaseRepository<Employee>(getContainer("employees")),
    "employees",
    validateEmployee,
);
