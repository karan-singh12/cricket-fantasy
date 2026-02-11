const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const db = require('../config/database');

const Users = {
  async create({ name, email, password, role = 'user', balance = 0 }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [user] = await db('users')
      .insert({
        name,
        email,
        password: hashedPassword,
        role,
        balance,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning(['id', 'name', 'email', 'role', 'balance']);
    return user;
  },

  async login(email, password) {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error('Invalid login credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid login credentials');
    }

    // Update last login timestamp
    await db('users')
      .where('id', user.id)
      .update({
        last_login: db.fn.now(),
        updated_at: db.fn.now()
      });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    };
  },

  async findByEmail(email) {
    return db('users')
      .where('email', email)
      .first();
  },

  async findById(id) {
    return db('users')
      .where('id', id)
      .first();
  },

  async updateBalance(id, balance) {
    const [user] = await db('users')
      .where('id', id)
      .update({
        balance,
        updated_at: db.fn.now()
      })
      .returning('*');
    return user;
  },

  async getAll() {
    return db('users')
      .select('id', 'name', 'email', 'role', 'balance', 'created_at', 'updated_at');
  },

  async changePassword(id, currentPassword, newPassword) {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const [updatedUser] = await db('users')
      .where('id', id)
      .update({
        password: hashedPassword,
        updated_at: db.fn.now()
      })
      .returning(['id', 'name', 'email', 'role']);
    return updatedUser;
  },

  async setResetPasswordToken(email) {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);

    await db('users')
      .where('id', user.id)
      .update({
        reset_password_token: hashedToken,
        reset_password_expires: db.raw('NOW() + interval \'1 hour\''),
        updated_at: db.fn.now()
      });

    return resetToken;
  },

  async resetPassword(token, newPassword) {
    const user = await db('users')
      .where('reset_password_token', token)
      .where('reset_password_expires', '>', db.fn.now())
      .first();

    if (!user) {
      throw new Error('Invalid or expired password reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const [updatedUser] = await db('users')
      .where('id', user.id)
      .update({
        password: hashedPassword,
        reset_password_token: null,
        reset_password_expires: null,
        updated_at: db.fn.now()
      })
      .returning(['id', 'name', 'email', 'role']);

    return updatedUser;
  }
};

module.exports = Users;