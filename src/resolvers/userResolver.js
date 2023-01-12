import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

import UserModel from '../models/User.js';
import TaskModel from '../models/Task.js';
import { checkAuth } from '../middlewares/checkAuth.js';
import { findUser } from '../middlewares/findUser.js';
import { userValidate } from '../validation/validation.js';

const generateToken = (_id) => {
    return jwt.sign(
        { _id },
        process.env.SECRET_KEY,
        { expiresIn: "2d" }
    )
};
const createPasswordHash = async (password) => {
    const salt = await bcrypt.genSalt(5);
    const passwordHash = await bcrypt.hash(password, salt);
    return passwordHash
};

const userResolver = {

    getUserByToken: async (_, context) => {
        const id = checkAuth(context.auth);
        const user = await findUser(id);

        const { _id, email, name, createdAt, avatarURL } = user;
        return {
            _id, email, name, createdAt, avatarURL,
            message: `User ${name} successfully logged via token`,
        };
    },

    userRegister: async ({ registerInput }) => {
        await userValidate(registerInput);
        const { email, name, password } = registerInput;

        const candidat = await UserModel.findOne({ email });
        if (candidat) {
            throw new Error(`User ${email} already exist`)
        }

        const passwordHash = await createPasswordHash(password);
        const user = await UserModel.create({
            email,
            passwordHash,
            name,
        });
        const token = generateToken(user._id);
        const { _id, createdAt } = user;

        return {
            _id, email, name, createdAt, token,
            message: `User ${name} successfully created`,
        };
    },

    userLogin: async ({ email, password }) => {
        await userValidate({ email, password });

        const user = await UserModel.findOne({ email });
        if (!user) {
            throw new Error("Can't find user")
        }

        const isValidPass = await bcrypt.compare(password, user.passwordHash)
        if (!isValidPass) {
            throw new Error('Incorrect login or password')
        }

        const token = generateToken(user._id);
        const { _id, name, avatarURL, createdAt } = user;

        return {
            _id, email, name, avatarURL, createdAt, token,
            message: `User ${name} successfully logged`
        };
    },

    userUpdateName: async ({ name }, context) => {
        await userValidate({ name });
        const id = checkAuth(context.auth);
        const user = await findUser(id);

        if (name === user.name) {
            throw new Error("The same name!")
        };

        const updatedUser = await UserModel.findOneAndUpdate(
            { _id: id },
            { name },
            { returnDocument: 'after' },
        );
        const { _id, email, avatarURL, createdAt } = updatedUser;

        return {
            _id, email, name: updatedUser.name, avatarURL, createdAt,
            message: `User ${updatedUser.name} successfully updated`,
        };
    },

    userDelete: async ({ _id }, context) => {
        const id = checkAuth(context.auth);
        const user = await findUser(id);

        if (id === _id) {
            if (user.avatarURL) {
                fs.unlink("uploads/" + user.avatarURL.split('/')[2], async (err) => {
                    if (err) {
                        throw new Error("Can't delete avatar")
                    }
                })
            }
            const taskStatus = await TaskModel.deleteMany({ author: id });
            const userStatus = await UserModel.deleteOne({ _id: id });

            return {
                taskStatus, userStatus,
                message: 'User successfully deleted'
            }
        } else {
            throw new Error("Authification error")
        }
    }

};

export default userResolver;