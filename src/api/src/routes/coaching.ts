import { createCrudRouter } from "./createCrudRouter";
import { BaseRepository } from "../models/baseRepository";
import { CoachingRecord } from "../models/coaching";
import { getContainer } from "../models/cosmosClient";

// Coaching collection — coaching/feedback records for employees.
export default createCrudRouter<CoachingRecord>(
    () => new BaseRepository<CoachingRecord>(getContainer("coaching")),
    "coaching",
);
