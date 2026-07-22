import type { User, UserLearningContext } from "#models/user.js";

export interface UserRepository {
  findById(userId: number): Promise<User | null>;

  findLearningContext(userId: number): Promise<UserLearningContext | null>;
}
