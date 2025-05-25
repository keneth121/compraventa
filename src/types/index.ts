
import type { Timestamp } from 'firebase/firestore';

export interface Product {
  id: string; // Firestore document ID
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string; // Volvemos a una sola imagen URL (Data URI o placeholder)
  imageHint?: string; // General hint for the product or primary image
  keywords?: string[];
  sellerId: string; // UID of the user who posted the product
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface UserProfile {
  uid: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  profileImageUrl?: string; // Will store Data URI or Storage URL
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface Chat {
  id: string; // Firestore document ID
  participantUids: [string, string];
  participantInfo?: {
    [uid: string]: {
      email?: string;
      username?: string;
      profileImageUrl?: string;
    };
  };
  productContext?: {
    productId: string;
    productName: string;
    productImageUrl?: string; // URL of the primary product image (string)
    sellerId?: string;
  };
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: Timestamp | Date;
  };
}

export interface Message {
  id: string; // Firestore document ID
  chatId: string;
  senderId: string;
  text: string;
  createdAt: Timestamp | Date;
}
