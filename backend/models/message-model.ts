export interface IMessage {
    mid: number;
    sender_uid: number;
    receiver_uid: number;
    content: string;
    nonce: string;
    timestamp: Date;
}

export interface IMessageDecrypted {
    mid:number,
    sender_uid: number;
    receiver_uid: number;
    content: string;
    timestamp: Date;
}
