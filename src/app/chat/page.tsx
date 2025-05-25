
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, getDoc } from 'firebase/firestore';
import type { Chat, UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageSquareText, Loader2, Inbox, Home } from 'lucide-react'; 
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added for index error alert

interface ChatWithParticipantProfile extends Chat {
  otherParticipantProfile?: UserProfile;
}

export default function ChatsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [chats, setChats] = useState<ChatWithParticipantProfile[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        router.push('/login');
      }
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (currentUser && !authLoading) {
      setChatsLoading(true);
      setFirestoreError(null);
      const chatsCollection = collection(db, 'chats');
      const q = query(
        chatsCollection,
        where('participantUids', 'array-contains', currentUser.uid),
        orderBy('updatedAt', 'desc')
      );

      const unsubscribeChats = onSnapshot(q, async (querySnapshot) => {
        if (querySnapshot.metadata.hasPendingWrites) {
          return;
        }
        const chatsDataPromises = querySnapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          const chat: Chat = {
            id: docSnapshot.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
            lastMessage: data.lastMessage && data.lastMessage.timestamp instanceof Timestamp
              ? { ...data.lastMessage, timestamp: data.lastMessage.timestamp.toDate() }
              : data.lastMessage,
          } as Chat;

          const chatWithProfile: ChatWithParticipantProfile = { ...chat };
          const otherUid = chat.participantUids.find(uid => uid !== currentUser.uid);

          if (otherUid) {
            if (chat.participantInfo && chat.participantInfo[otherUid]) {
               chatWithProfile.otherParticipantProfile = {
                 uid: otherUid,
                 username: chat.participantInfo[otherUid]?.username || chat.participantInfo[otherUid]?.email || 'Usuario',
                 email: chat.participantInfo[otherUid]?.email || '',
                 profileImageUrl: chat.participantInfo[otherUid]?.profileImageUrl,
                 firstName: '', lastName: '', createdAt: new Date()
               };
            } else {
              try {
                const userDocRef = doc(db, "users", otherUid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                  chatWithProfile.otherParticipantProfile = userDocSnap.data() as UserProfile;
                }
              } catch (fetchError) {
                console.error(`Error fetching profile for UID ${otherUid}:`, fetchError);
              }
            }
          }
          return chatWithProfile;
        });
        
        const resolvedChatsData = await Promise.all(chatsDataPromises);
        setChats(resolvedChatsData);
        setChatsLoading(false);
      }, (error: any) => {
        console.error("Error fetching chats:", error);
        if (error.code === 'failed-precondition') {
          setFirestoreError("Error: La consulta de chats requiere un índice en Firestore. Revisa la consola para el enlace para crearlo (Campos: participantUids (array-contains), updatedAt (desc)).");
        } else {
          setFirestoreError(`Error al cargar los chats: ${error.message}`);
        }
        setChatsLoading(false);
      });

      return () => unsubscribeChats();
    } else if (!authLoading && !currentUser) {
        setChatsLoading(false);
    }
  }, [currentUser, authLoading]);

  if (authLoading || (!currentUser && !authLoading && chatsLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Cargando tus chats...</p>
      </div>
    );
  }

  const getOtherParticipantDisplayName = (chat: ChatWithParticipantProfile) => {
    const otherUid = chat.participantUids.find(uid => uid !== currentUser?.uid);
    if (!otherUid) return "Otro Usuario";
    if (chat.participantInfo && chat.participantInfo[otherUid]?.username && chat.participantInfo[otherUid]?.username !== "Usuario") {
      return chat.participantInfo[otherUid]?.username as string;
    }
    if (chat.otherParticipantProfile?.username && chat.otherParticipantProfile.username !== 'Usuario') {
      return chat.otherParticipantProfile.username;
    }
    if (chat.participantInfo && chat.participantInfo[otherUid]?.email) {
        return chat.participantInfo[otherUid]?.email as string;
    }
    if (chat.otherParticipantProfile?.email) {
      return chat.otherParticipantProfile.email;
    }
    return "Otro Usuario";
  };
  
  const getOtherParticipantAvatarUrl = (chat: ChatWithParticipantProfile) => {
     const otherUid = chat.participantUids.find(uid => uid !== currentUser?.uid);
     if (chat.productContext?.productId && chat.productContext?.sellerId === otherUid && chat.productContext.productImageUrl) {
        return chat.productContext.productImageUrl;
     }
     if (otherUid && chat.participantInfo && chat.participantInfo[otherUid]?.profileImageUrl) {
         return chat.participantInfo[otherUid]?.profileImageUrl;
     }
     return chat.otherParticipantProfile?.profileImageUrl;
  }
  
  const getFallbackLetter = (chat: ChatWithParticipantProfile) => {
    const name = getOtherParticipantDisplayName(chat);
    return name ? name.charAt(0).toUpperCase() : "U";
  };


  return (
    <div className="container mx-auto px-4 py-8 mt-4">
      <Button variant="outline" onClick={() => router.push('/')} className="mb-6">
        <Home className="mr-2 h-4 w-4" /> Volver al Inicio
      </Button>
      <Card className="w-full max-w-2xl mx-auto shadow-xl rounded-lg">
        <CardHeader className="border-b">
          <CardTitle className="text-2xl font-bold text-foreground flex items-center">
            <MessageSquareText className="mr-3 h-6 w-6 text-primary" />
            Mis Chats
          </CardTitle>
          <CardDescription>Tus conversaciones recientes.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {firestoreError && (
            <Alert variant="destructive" className="m-4">
              <AlertTitle>Error de Base de Datos</AlertTitle>
              <AlertDescription>{firestoreError}</AlertDescription>
            </Alert>
          )}
          {chatsLoading && !firestoreError ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="ml-2">Cargando conversaciones...</p>
            </div>
          ) : !chatsLoading && chats.length === 0 && !firestoreError ? (
            <div className="text-center py-10 text-muted-foreground">
              <Inbox className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="mb-2 text-lg">No tienes chats activos.</p>
              <p className="text-sm">Inicia una conversación desde la página de un producto.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {chats.map(chat => (
                <li key={chat.id}>
                  <Link href={`/chat/${chat.id}`} passHref>
                    <div className="block hover:bg-muted/50 transition-colors p-4 cursor-pointer">
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage 
                            src={getOtherParticipantAvatarUrl(chat)} 
                            alt={getOtherParticipantDisplayName(chat)} 
                            data-ai-hint={chat.productContext?.productName ? "product image" : "profile avatar"}
                          />
                          <AvatarFallback>{getFallbackLetter(chat)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <p className="text-md font-semibold text-foreground truncate">
                              {chat.productContext?.productName ? `Sobre: ${chat.productContext.productName}` : getOtherParticipantDisplayName(chat)}
                            </p>
                            {chat.updatedAt && (
                               <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true, locale: es })}
                              </p>
                            )}
                          </div>
                           {chat.productContext?.productName && (
                             <p className="text-sm text-muted-foreground truncate">
                                Con: {getOtherParticipantDisplayName(chat)}
                             </p>
                           )}
                          {chat.lastMessage ? (
                            <p className="text-sm text-muted-foreground truncate">
                              {chat.lastMessage.senderId === currentUser?.uid ? "Tú: " : ""}
                              {chat.lastMessage.text}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No hay mensajes aún.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
