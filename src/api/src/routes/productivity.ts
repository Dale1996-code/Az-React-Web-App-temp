import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository } from "../models/baseRepository";
import { ProductivityRecord } from "../models/productivity";
import { getContainer } from "../models/cosmosClient";

// Productivity collection — daily productivity entries per employee.
export default createCrudRouter<ProductivityRecord>(
    () => new BaseRepository<ProductivityRecord>(getContainer("productivity")),
    "productivity",
);
