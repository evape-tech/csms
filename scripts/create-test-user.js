import bcrypt from 'bcryptjs';
import models from '../src/models/index.js';

async function createTestUser() {
  try {
    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Create test user
    const user = await models.User.create({
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin'
    });
    
    console.log('Test user created successfully:', {
      id: user.id,
      email: user.email,
      role: user.role
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
}

createTestUser();
