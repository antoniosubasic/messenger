import { Router, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { DbSession } from '../db';
import { MessageResponse, MessageUtils } from '../utilities/message-utils';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth-middleware';
import { io } from '../app';
import { IMessage, IMessageDecrypted } from '../models/message-model';


export const msgRouter = Router();

msgRouter.get('/:userId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.userId);
    const receiverId = parseInt(req.query.receiverId as string);

    if (userId !== req.user?.uid) {
        res.status(StatusCodes.FORBIDDEN).send({
            error: 'You can only access your own messages'
        });
        return;
    }

    let dbSession = await DbSession.create(true);
    try {
        const msgUtils = new MessageUtils(dbSession);

        const response: MessageResponse = await msgUtils.fetchMessage(userId, receiverId);

        res.status(response.statusCode).json(
            response.data !== null ? response.data : { error: response.error }
        );
    } catch (error) {
        console.error(error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            error: 'An unexpected error occurred while fetching messages'
        });
    } finally {
        await dbSession.complete();
    }
});

msgRouter.post('/:userId/:receiverId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.userId);
    const receiverId = parseInt(req.params.receiverId);
    const { content, nonce } = req.body;

    if (userId !== req.user?.uid) {
        res.status(StatusCodes.FORBIDDEN).send({
            error: 'You can only send messages as yourself'
        });
        return;
    }

    let dbSession = await DbSession.create(false);
    try {
        const msgUtils = new MessageUtils(dbSession);

        const response = await msgUtils.sendMessage(userId, receiverId, content, nonce);

        await dbSession.complete(response.statusCode === StatusCodes.OK);

        // If message was successfully sent, emit a WebSocket event to both sender and receiver
        if (response.statusCode === StatusCodes.OK && response.data) {
            // Emit to the sender's room
            io.to(`user_${userId}`).emit('new_message', response.data);

            // Emit to the receiver's room
            io.to(`user_${receiverId}`).emit('new_message', response.data);
        }

        res.status(response.statusCode).json(
            response.data !== null ? response.data : { error: response.error }
        );
    } catch (error) {
        console.error(error);
        await dbSession.complete(false);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            error: "An unexpected error occurred while processing your request"
        });
    }
});

msgRouter.post('/decrypted/:userId/:receiverID', authenticateToken, async (req: AuthenticatedRequest,res:Response) => {
    const userId = parseInt(req.params.userId);
    const receiverId = parseInt(req.params.receiverID);

    const { content } = req.body as { content: IMessageDecrypted[] };

    
    if (userId !== req.user?.uid) {
        res.status(StatusCodes.FORBIDDEN).send({
            error: 'You can only send messages as yourself'
        });
        return;
    }

    let db = await DbSession.create(false);
    try {
        const msgUtils = new MessageUtils(db);

        const response = await msgUtils.storeDecryptedMessages(userId,receiverId,content);

        await db.complete(response.statusCode === StatusCodes.OK);

        res.status(response.statusCode).json(response)

    } catch (error) {
        console.error(error);
        await db.complete(false);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            error: "An unexpected error occurred while processing your request"
        });
    }



});
