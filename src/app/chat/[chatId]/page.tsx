
"use client";

import { useEffect, useState, useRef, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import type { Chat, Message, UserProfile } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Send, Loader2, AlertTriangle, UserCircle, Paperclip } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format, type Locale } from 'date-fns';
import { es } from 'date-fns/locale';

export default function IndividualChatPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [otherUserProfile, setOtherUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [chatDetails, setChatDetails] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatId = typeof params.chatId === 'string' ? params.chatId : null;

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setCurrentUserProfile(userDocSnap.data() as UserProfile);
        } else {
          setCurrentUserProfile(null); 
        }
      } else {
        toast({ title: "Autenticación Requerida", description: "Debes iniciar sesión para ver los chats.", variant: "destructive"});
        router.push('/login');
      }
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, [router, toast]);

  useEffect(() => { 
    setMessages([]);
    setChatDetails(null);
    setNewMessage("");
    setError(null); 
    setLoading(true); 
    setOtherUserProfile(null);
  }, [chatId]);

  useEffect(() => {
    if (authLoading || !currentUser || !chatId) {
      if (!authLoading && !currentUser) {
         setError("Usuario no autenticado. No se pueden cargar los detalles del chat.");
      }
      if (!authLoading && !chatId) {
         setError("ID de chat no válido.");
      }
      if (currentUser && !authLoading && !chatId) { 
        setLoading(false); // Set loading to false if currentUser is available but no chatId
      }
      return;
    }
    
    setLoading(true);
    setError(null); // Reset error at the beginning of fetch attempt
    const chatRef = doc(db, 'chats', chatId);
    let unsubscribeMessages: (() => void) | null = null;

    const fetchOtherUserProfile = async (otherUid: string) => {
      if (!otherUid) return;
      const userDocRef = doc(db, "users", otherUid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        setOtherUserProfile(userDocSnap.data() as UserProfile);
      } else {
        setOtherUserProfile(null);
      }
    };

    const unsubscribeChatDetails = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        const chatData = docSnap.data() as Omit<Chat, 'id' | 'createdAt' | 'updatedAt' | 'lastMessage'> & { createdAt?: Timestamp, updatedAt?: Timestamp, lastMessage?: { timestamp?: Timestamp } };

        if (!chatData.participantUids || !chatData.participantUids.includes(currentUser.uid)) {
          setError("Acceso Denegado: No eres participante de este chat.");
          setChatDetails(null);
          setLoading(false);
          toast({ title: "Acceso Denegado", description: "No eres participante de este chat.", variant: "destructive" });
          return;
        }
        
        const processedChatData: Chat = {
          id: docSnap.id,
          participantUids: chatData.participantUids,
          participantInfo: chatData.participantInfo || {}, 
          productContext: chatData.productContext,
          createdAt: chatData.createdAt instanceof Timestamp ? chatData.createdAt.toDate() : new Date(),
          updatedAt: chatData.updatedAt instanceof Timestamp ? chatData.updatedAt.toDate() : (chatData.updatedAt ? new Date(chatData.updatedAt as any) : undefined),
          lastMessage: chatData.lastMessage 
            ? { 
                ...chatData.lastMessage, 
                timestamp: chatData.lastMessage.timestamp instanceof Timestamp ? chatData.lastMessage.timestamp.toDate() : (chatData.lastMessage.timestamp ? new Date(chatData.lastMessage.timestamp as any) : new Date())
              } 
            : undefined,
        };
        setChatDetails(processedChatData);

        const otherUid = processedChatData.participantUids.find(uid => uid !== currentUser.uid);
        if (otherUid) {
          fetchOtherUserProfile(otherUid);
        }

        const messagesColRef = collection(db, 'chats', chatId, 'messages');
        const qMessages = query(messagesColRef, orderBy('createdAt', 'asc'));
        
        if (unsubscribeMessages) unsubscribeMessages(); 
        
        unsubscribeMessages = onSnapshot(qMessages, (querySnapshot) => {
          const msgs = querySnapshot.docs.map(msgDoc => {
            const data = msgDoc.data();
            return {
              id: msgDoc.id,
              ...data,
              createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt as any),
            } as Message;
          });
          setMessages(msgs);
          setError(null); 
          setLoading(false); // Only set loading false after messages are fetched
        }, (messagesFetchError: any) => {
           console.error("Error fetching messages:", messagesFetchError);
           const specificError = messagesFetchError.code ? ` (${messagesFetchError.code})` : '';
           setError(`Error al cargar mensajes:${specificError}. Revisa las reglas de Firestore para la subcolección 'messages'.`);
           setLoading(false);
        });

      } else {
        setError("Chat no encontrado.");
        setChatDetails(null);
        setLoading(false);
      }
    }, (chatDetailsFetchError: any) => {
      console.error("Error fetching chat details:", chatDetailsFetchError);
      const specificError = chatDetailsFetchError.code ? ` (${chatDetailsFetchError.code})` : '';
      setError(`Error al cargar los detalles del chat: ${specificError}.`);
      setLoading(false);
    });

    return () => {
      unsubscribeChatDetails();
      if (unsubscribeMessages) unsubscribeMessages();
    };
  }, [chatId, currentUser, authLoading, toast]);

  useEffect(() => {
    if (messages.length > 0 && !loading && !error) { 
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, error]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !chatId || !chatDetails) return;

    setSending(true);
    const messagesColRef = collection(db, 'chats', chatId, 'messages');
    const chatDocRef = doc(db, 'chats', chatId);

    try {
      await addDoc(messagesColRef, {
        chatId: chatId,
        senderId: currentUser.uid,
        text: newMessage.trim(),
        createdAt: serverTimestamp(),
      });

      const participantInfoUpdate: Chat['participantInfo'] = { ...(chatDetails.participantInfo || {}) };
      if (currentUserProfile && (!participantInfoUpdate[currentUser.uid] || !participantInfoUpdate[currentUser.uid]?.username)) {
          participantInfoUpdate[currentUser.uid] = { 
            ...participantInfoUpdate[currentUser.uid], 
            email: currentUserProfile.email,
            username: currentUserProfile.username,
            profileImageUrl: currentUserProfile.profileImageUrl 
          };
      }
      
      await updateDoc(chatDocRef, {
        updatedAt: serverTimestamp(),
        lastMessage: {
          text: newMessage.trim(),
          senderId: currentUser.uid,
          timestamp: serverTimestamp(),
        },
        participantInfo: participantInfoUpdate
      });

      setNewMessage("");
    } catch (err: any) {
      console.error("Error sending message:", err);
      const specificError = err.code ? ` (${err.code})` : '';
      toast({ title: "Error al Enviar", description: `No se pudo enviar el mensaje.${specificError}`, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const getOtherParticipantDisplayName = () => {
    if (!currentUser || !chatDetails) return "Otro Usuario";
    const otherUid = chatDetails.participantUids.find(uid => uid !== currentUser.uid);
    if (!otherUid) return "Otro Usuario";
    
    if (otherUserProfile?.username && otherUserProfile.username !== "Usuario") return otherUserProfile.username;
    if (chatDetails.participantInfo && chatDetails.participantInfo[otherUid]?.username) return chatDetails.participantInfo[otherUid]?.username as string;
    if (chatDetails.participantInfo && chatDetails.participantInfo[otherUid]?.email) return chatDetails.participantInfo[otherUid]?.email as string;
    if (otherUserProfile?.email) return otherUserProfile.email;
    return "Otro Usuario";
  };
  
  const getOtherParticipantAvatarUrl = () => {
    if (!currentUser || !chatDetails) return undefined;
    const otherUid = chatDetails.participantUids.find(uid => uid !== currentUser.uid);
    if (!otherUid) return undefined;

    // Prioritize product image if context matches seller
    if (chatDetails.productContext?.sellerId === otherUid && chatDetails.productContext?.productImageUrl) {
        return chatDetails.productContext.productImageUrl;
    }
    // Then try other user's profile image from UserProfile state
    if (otherUserProfile?.profileImageUrl) return otherUserProfile.profileImageUrl;
    // Then try participant info from chat document
    if (chatDetails.participantInfo && chatDetails.participantInfo[otherUid]?.profileImageUrl) return chatDetails.participantInfo[otherUid]?.profileImageUrl;
    return undefined; // Fallback to default (will show AvatarFallback)
  }

  const getOtherParticipantAvatarFallback = () => {
    const displayName = getOtherParticipantDisplayName();
    return displayName ? displayName.charAt(0).toUpperCase() : "U";
  };

  const getCurrentUserAvatarFallback = () => {
    if (currentUserProfile?.username) return currentUserProfile.username.charAt(0).toUpperCase();
    if (currentUser?.email) return currentUser.email.charAt(0).toUpperCase();
    return "TÚ";
  };


  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Autenticando...</p>
      </div>
    );
  }

  if (error) { 
    return (
      <div className="container mx-auto px-4 py-8 mt-4 flex flex-col items-center text-center">
        <Card className="w-full max-w-md shadow-xl rounded-lg p-8">
          <AlertTriangle className="h-16 w-16 mx-auto text-destructive mb-4" />
          <h2 className="text-2xl font-semibold mb-2 text-destructive">Error en el Chat</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push('/chat')} style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Mis Chats
          </Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Cargando chat...</p>
      </div>
    );
  }
  
  if (!chatDetails) { 
    return (
      <div className="container mx-auto px-4 py-8 mt-4 text-center">
         <Card className="w-full max-w-md shadow-xl rounded-lg p-8">
            <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Chat no Disponible</h2>
            <p className="text-muted-foreground mb-6">No se pudo cargar el chat. Es posible que no exista o no tengas acceso.</p>
            <Button onClick={() => router.push('/chat')} style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Mis Chats
            </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-40 shadow-sm border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/chat')} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10">
             <AvatarImage 
                src={getOtherParticipantAvatarUrl()} 
                alt="Avatar" 
                data-ai-hint={chatDetails.productContext?.productName ? "product image" : "profile avatar"} 
            />
            <AvatarFallback>{getOtherParticipantAvatarFallback()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">
              {chatDetails.productContext?.productName ? `Chat sobre: ${chatDetails.productContext.productName}` : getOtherParticipantDisplayName()}
            </p>
             {chatDetails.productContext?.productName && (
                <p className="text-xs text-muted-foreground">
                    Con: {getOtherParticipantDisplayName()}
                </p>
             )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !loading && ( 
          <div className="text-center text-muted-foreground py-10">
            <p>No hay mensajes en este chat todavía.</p>
            <p>¡Envía el primer mensaje!</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-end max-w-[70%] space-x-2 ${msg.senderId === currentUser?.uid ? 'flex-row-reverse space-x-reverse' : ''}`}>
              {msg.senderId !== currentUser?.uid && (
                <Avatar className="h-8 w-8 self-start mt-1">
                   <AvatarImage 
                    src={getOtherParticipantAvatarUrl()} 
                    alt="Avatar del otro usuario" 
                    data-ai-hint={chatDetails.productContext?.sellerId === msg.senderId && chatDetails.productContext?.productName ? "product seller avatar" : "profile avatar"}
                  />
                  <AvatarFallback>{getOtherParticipantAvatarFallback()}</AvatarFallback>
                </Avatar>
              )}
               {msg.senderId === currentUser?.uid && (
                <Avatar className="h-8 w-8 self-start mt-1">
                  <AvatarImage src={currentUserProfile?.profileImageUrl} alt="Avatar del usuario actual" data-ai-hint="profile avatar"/>
                  <AvatarFallback>{getCurrentUserAvatarFallback()}</AvatarFallback>
                </Avatar>
              )}
              <div
                className={`p-3 rounded-xl shadow-md ${
                  msg.senderId === currentUser?.uid
                    ? 'bg-primary text-primary-foreground rounded-br-none'
                    : 'bg-muted text-foreground rounded-bl-none'
                }`}
              >
                <p className="text-sm">{msg.text}</p>
                <p className={`text-xs mt-1 ${msg.senderId === currentUser?.uid ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground/70 text-left'}`}>
                  {format(new Date(msg.createdAt), 'p, MMM d', { locale: es })}
                </p>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="sticky bottom-0 z-10 border-t bg-card p-2 sm:p-4">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2 sm:space-x-3">
          <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => toast({title: "Próximamente", description: "Adjuntar archivos estará disponible pronto."})}>
            <Paperclip className="h-5 w-5" />
            <span className="sr-only">Adjuntar archivo</span>
          </Button>
          <Input
            type="text"
            placeholder="Escribe un mensaje..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-background focus-visible:ring-primary/50 text-sm sm:text-base"
            disabled={sending || !chatDetails || !!error}
          />
          <Button type="submit" size="icon" disabled={sending || !newMessage.trim() || !chatDetails || !!error} className="bg-primary hover:bg-primary/90">
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            <span className="sr-only">Enviar mensaje</span>
          </Button>
        </form>
      </footer>
    </div>
  );
}
