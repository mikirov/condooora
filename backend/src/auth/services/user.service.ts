import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, User } from '../entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Create a new user
   * @param userDto - Partial user data
   * @returns - Created user
   */
  async createUser(userDto: Partial<User>): Promise<User> {
    const newUser = this.userRepository.create(userDto);
    return this.userRepository.save(newUser);
  }

  /**
   * Find a user by ID
   * @param id - User ID
   * @returns - User or null
   */
  async findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Find a user by card ID
   * @param cardId - Card ID
   * @returns - User or null
   */
  async findByCardId(cardId: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { cardId } });
  }

  /**
   * Update a user by ID
   * @param id - User ID
   * @param updateData - Partial user data to update
   * @returns - Updated user
   */
  async updateUser(id: number, updateData: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.userRepository.update(id, updateData);
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Delete a user by ID
   * @param id - User ID
   * @returns - Deletion result
   */
  async deleteUser(id: number): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.userRepository.remove(user);
  }

  /**
   * Get all users
   * @returns - List of all users
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  /**
   * Get users by role
   * @param role - Role to filter users
   * @returns - List of users with the specified role
   */
  async findByRole(role: Role): Promise<User[]> {
    return this.userRepository.find({ where: { role } });
  }

  /**
   * Increment the user's time in office
   * @param cardId - Card ID of the user
   * @param timeInMs - Time in milliseconds to add
   */
  async incrementTimeInOffice(cardId: number, timeInMs: number): Promise<void> {
    const user = await this.findByCardId(cardId);
    if (!user) {
      throw new NotFoundException(`User with card ID ${cardId} not found`);
    }

    user.timeInOffice += timeInMs;
    user.isInsideWorkplace = false; // Mark as outside workplace
    user.endTime = Date.now(); // Update the end time
    await this.userRepository.save(user);
  }

  /**
   * Mark a user as inside the workplace
   * @param cardId - Card ID of the user
   */
  async markUserInsideWorkplace(cardId: number): Promise<void> {
    const user = await this.findByCardId(cardId);
    if (!user) {
      throw new NotFoundException(`User with card ID ${cardId} not found`);
    }

    user.startTime = user.isInsideWorkplace ? user.startTime : Date.now(); // Keep existing start time or set new
    user.isInsideWorkplace = true; // Mark as inside workplace
    await this.userRepository.save(user);
  }

  /**
   * Reset a user's workplace state
   * @param cardId - Card ID of the user
   */
  async resetWorkplaceState(cardId: number): Promise<void> {
    const user = await this.findByCardId(cardId);
    if (!user) {
      throw new NotFoundException(`User with card ID ${cardId} not found`);
    }

    user.isInsideWorkplace = false;
    user.startTime = null;
    user.endTime = null;
    await this.userRepository.save(user);
  }
}
