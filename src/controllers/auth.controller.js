import database from '../models/index';
import ResponseGenerator from '../utils/response.utilities';
import GeneralUtils from '../utils/general.utilities';
import Auth from '../middlewares/auth.middleware';
import sendEmail from '../services/email.service';

const response = new ResponseGenerator();

class AuthController {
  /**
   * @param {object} request express request object
   * @param {object} response express response object
   * @returns {json} json
   * @memberof UserController
   */

  static async signup(req, res) {
    try {
      const { email } = req.body;
      const foundUser = await database.User.findOne({
        where: { email }
      });
      if (foundUser) {
        return res.status(400).json({
          status: 'error',
          message: 'Email is already in use'
        });
      }
      req.body.password = await GeneralUtils.hash(req.body.password);
      const newUser = await database.User.create(req.body);
      const result = newUser.toJSON();
      const token = Auth.signJwt(result);
      delete result.password;
      if (result.email) {
        // 3) Send verification link  to user's email
        const verificationURL = `${req.protocol}://${req.get('host')}/api/v1/auth/verification/${token}`;

        const message = ` Click on this link to verify your account: ${verificationURL}`;
        await sendEmail({
          email: result.email,
          subject: 'Your link only (valid for some mins)',
          message
        });
        return response.sendSuccess(res, 201, {
          token,
          ...result
        });
      }
      return response.sendError(res, 500, 'Something went wrong');
    } catch (err) {
      return response.sendError(res, 400, err.message);
    }
  }

  /** verify User by email
   * @description Operate on a user and his account
   * @param {object} user object is updated
   */

  static async isVerified(req, res) {
    try {
      const { token } = req.params;
      const decoded = await Auth.decodeJwt(token);
      if (decoded) {
        await database.User.update({ isVerified: true }, { where: { id: decoded.id } });
        return res.status(200).json({
          status: 'success',
          message: 'your account has been verified, Welcome'
        });
      }
      return response.sendError(res, 500, 'Your token has expired or it is not valid');
    } catch (error) {
      return response.sendError(res, 500, error.message);
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;
      const user = await database.User.findOne({ where: { email } });
      if (!user) {
        return response.sendError(res, 403, 'Invalid credentials');
      }
      const {
        firstName, lastName, isVerified, role
      } = user;

      if (!isVerified) {
        return response.sendError(res, 400, 'Your account has not been verified');
      }
      const isPasswordValid = await GeneralUtils.compare(password, user.password);

      if (!isPasswordValid) {
        return response.sendError(res, 403, 'Invalid credentials');
      }

      const token = await Auth.signJwt(user);
      return response.sendSuccess(res, 201, {
        token,
        firstName,
        lastName,
        role
      });
    } catch (error) {
      return response.sendError(res, 400, error.message);
    }
  }
}

export default AuthController;
