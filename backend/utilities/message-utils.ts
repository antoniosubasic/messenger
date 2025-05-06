import { StatusCodes } from "http-status-codes";
import { IMessage,IMessageDecrypted } from "../models/message-model";

import { BaseResponse, Utils } from "./utils";

export type MessageResponse = BaseResponse<IMessage[]>

export type DecryptedMessageResponse = BaseResponse<IMessageDecrypted[]>



export class MessageUtils extends Utils {
    
    /**
     * Send a message from one user to another to the database unencrypted 
     * @param sender_uid Sender User ID 
     * @param receiver_uid Receiver User ID
     * @param content Message content
     * @returns A MessageResponse object containing statusCode, data, and optional error message
    */
   async sendMessage(sender_uid: number, receiver_uid: number, content: string, nonce: string): Promise<BaseResponse<IMessage>> {
       if (!this.isValidUserId(sender_uid) || !this.isValidUserId(receiver_uid)) {
           return this.createErrorResponse(
               StatusCodes.BAD_REQUEST,
               'Invalid UID'
            );
        }
        
        if (!(await this.userExists(sender_uid)) || !(await this.userExists(receiver_uid))) {
            return this.createErrorResponse(
                StatusCodes.NOT_FOUND,
                'User not found'
            );
        }
        
        if (sender_uid === receiver_uid) {
            return this.createErrorResponse(
                StatusCodes.BAD_REQUEST,
                'Cannot send message to self'
            );
        }
        
        if (!(await this.hasContactWith(sender_uid, receiver_uid))) {
            return this.createErrorResponse(
                StatusCodes.FORBIDDEN,
                'Users are not contacts'
            );
        }
        
        // Check if the user can send messages and get specific reason if not
        const messagePermission = await this.canSendMessage(sender_uid, receiver_uid);
        if (!messagePermission.canSend) {
            // Provide more specific error messages based on the reason
            if (messagePermission.reason === 'you_blocked') {
                return this.createErrorResponse(
                    StatusCodes.FORBIDDEN,
                    'Cannot message, you have blocked this user'
                );
            } else if (messagePermission.reason === 'user_blocked') {
                return this.createErrorResponse(
                    StatusCodes.FORBIDDEN,
                    'Cannot message user, user has blocked you'
                );
            } else {
                // Default message for other cases
                return this.createErrorResponse(
                    StatusCodes.FORBIDDEN,
                    'Cannot send message to this user'
                );
            }
        }
        
        try {
            const result = await this.dbSession.query(`
                INSERT INTO message (sender_uid, receiver_uid, content, nonce)
                VALUES ($1, $2, $3, $4)
                RETURNING mid, sender_uid, receiver_uid, content, nonce, timestamp`,
                [sender_uid, receiver_uid, content, nonce]
            );
            
            if (result.rowCount === 0) {
                return this.createErrorResponse(
                    StatusCodes.INTERNAL_SERVER_ERROR,
                    'Failed to send message'
                );
            }
            
            const message: IMessage = {
                mid: result.rows[0].mid,
                sender_uid: result.rows[0].sender_uid,
                receiver_uid: result.rows[0].receiver_uid,
                content: result.rows[0].content,
                nonce: result.rows[0].nonce,
                timestamp: result.rows[0].timestamp
            };
            
            return this.createSuccessResponse(message);
        } catch (error) {
            console.error('Error sending message:', error);
            return this.createErrorResponse(
                StatusCodes.INTERNAL_SERVER_ERROR,
                'Failed to send message.'
            );
        }
    }
    
    async storeDecryptedMessages(sender_uid: number, receiver_uid: number, content: IMessageDecrypted[]): Promise<DecryptedMessageResponse> {
        if (!this.isValidUserId(sender_uid) || !this.isValidUserId(receiver_uid)) {
            return Promise.resolve(this.createErrorResponse(
                StatusCodes.BAD_REQUEST,
                'Invalid UID'
             ));
         }
         
         if (!(await this.userExists(sender_uid)) || !(await this.userExists(receiver_uid))) {
             return Promise.resolve(this.createErrorResponse(
                 StatusCodes.NOT_FOUND,
                 'User not found'
             ));
         }
         
         if (sender_uid === receiver_uid) {
             return Promise.resolve(this.createErrorResponse(
                 StatusCodes.BAD_REQUEST,
                 'Cannot send message to self'
             ));
         }
         
         if (!(await this.hasContactWith(sender_uid, receiver_uid))) {
             return Promise.resolve(this.createErrorResponse(
                 StatusCodes.FORBIDDEN,
                 'Users are not contacts'
             ));
         }

         if(content.length === 0){
            return Promise.resolve(this.createErrorResponse(
                StatusCodes.BAD_REQUEST,
                "No Messages to push"
            ));
         }
         const fetchedMessages:IMessageDecrypted[] = [];
         try {
            for(const message of content){
                const result = await this.dbSession.query(`
                    INSERT INTO decrypted_messages (sender_uid, receiver_uid, content,timestamp)
                    VALUES ($1, $2, $3, $4)
                    RETURNING mid, sender_uid, receiver_uid, content, timestamp`,
                    [message.sender_uid, message.receiver_uid, message.content,message.timestamp]);
                
                    fetchedMessages.push(result.rows[0]);
                }


            return Promise.resolve(this.createSuccessResponse(
                fetchedMessages,
                StatusCodes.OK
            ));


         } catch (error) {
            return Promise.resolve(this.createErrorResponse(
                StatusCodes.INTERNAL_SERVER_ERROR,
                'Error processing message'
            ));
         }

    }  

    /**
     * Fetches messages between two users
     * @param sender_uid The ID of the sender
     * @param receiver_uid The ID of the receiver
     * @returns A MessageResponse object containing statusCode, data, and optional error message
    */
   public async fetchMessage(sender_uid: number, receiver_uid: number): Promise<MessageResponse> {
       if (!this.isValidUserId(sender_uid) || !this.isValidUserId(receiver_uid)) {
           return this.createErrorResponse(
               StatusCodes.BAD_REQUEST,
               'Invalid UID'
            );
        }
        
        if (!(await this.userExists(sender_uid)) || !(await this.userExists(receiver_uid))) {
            return this.createErrorResponse(
                StatusCodes.NOT_FOUND,
                'User not found'
            );
        }

        if (sender_uid === receiver_uid) {
            return this.createErrorResponse(
                StatusCodes.BAD_REQUEST,
                'Cannot fetch messages with self'
            );
        }

        try {
            const result = await this.dbSession.query(`
            SELECT m.mid, m.sender_uid, m.receiver_uid, m.content, m.nonce, m.timestamp
            FROM message m
            WHERE (m.sender_uid = $1 AND m.receiver_uid = $2) 
               OR (m.sender_uid = $2 AND m.receiver_uid = $1)
            ORDER BY m.timestamp ASC`,
                [sender_uid, receiver_uid]
            );

            const messages: IMessage[] = result.rows.map(row => ({
                mid: row.mid,
                sender_uid: row.sender_uid,
                receiver_uid: row.receiver_uid,
                content: row.content,
                nonce: row.nonce,
                timestamp: row.timestamp
            }));

            return this.createSuccessResponse(messages);
        } catch (error) {
            console.error('Error fetching messages:', error);
            return this.createErrorResponse(
                StatusCodes.INTERNAL_SERVER_ERROR,
                'Failed to fetch messages.'
            );
        }
    }
}
