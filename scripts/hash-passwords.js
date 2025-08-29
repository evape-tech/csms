import bcrypt from 'bcryptjs';
import models from '../src/models/index.js';

async function hashPlaintextPasswords() {
  try {
    // Find all users with plain text passwords (not starting with $2)
    const users = await models.User.findAll({
      where: {
        password: {
          [models.sequelize.Sequelize.Op.notLike]: '$2%'
        }
      }
    });
    
    console.log(`Found ${users.length} users with plain text passwords`);
    
    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await user.update({ password: hashedPassword });
      console.log(`Updated password for user: ${user.email}`);
    }
    
    console.log('All plain text passwords have been hashed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error hashing passwords:', error);
    process.exit(1);
  }
}

hashPlaintextPasswords();
