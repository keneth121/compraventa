
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, Timestamp, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { Product, Chat, UserProfile } from '@/types';
import type { User } from 'firebase/auth';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MessageSquare, ShoppingCart, Loader2, AlertTriangle, ServerCrash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isContactingSeller, setIsContactingSeller] = useState(false);

  const productId = typeof params.id === 'string' ? params.id : null;

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!productId) {
      setError("ID de producto no válido.");
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const productRef = doc(db, 'products', productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const productData = productSnap.data();
          setProduct({
            id: productSnap.id,
            ...productData,
            createdAt: productData.createdAt instanceof Timestamp ? productData.createdAt.toDate() : new Date(productData.createdAt),
            updatedAt: productData.updatedAt instanceof Timestamp ? productData.updatedAt.toDate() : productData.updatedAt ? new Date(productData.updatedAt) : undefined,
          } as Product);
        } else {
          setError("Producto no encontrado.");
          toast({
            title: "Error",
            description: "El producto que buscas no existe o ha sido eliminado.",
            variant: "destructive",
          });
        }
      } catch (err: any) {
        console.error("Error fetching product:", err);
        setError("Error al cargar el producto. Inténtalo de nuevo.");
        toast({
          title: "Error de Carga",
          description: `No se pudo cargar el producto. ${err.message}`,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, toast]);

  const handleContactSeller = async () => {
    if (!currentUser) {
      toast({ title: "Autenticación Requerida", description: "Debes iniciar sesión para contactar al vendedor.", variant: "destructive" });
      router.push('/login');
      return;
    }
    if (!product || !product.sellerId) {
      toast({ title: "Error", description: "No se pudo obtener la información del vendedor.", variant: "destructive" });
      return;
    }
    if (currentUser.uid === product.sellerId) {
      toast({ title: "Información", description: "No puedes iniciar un chat contigo mismo.", variant: "default" });
      return;
    }

    setIsContactingSeller(true);
    let buyerProfile: UserProfile | null = null;
    let sellerProfile: UserProfile | null = null;

    // 1. Get Buyer's Profile
    try {
      const buyerDocRef = doc(db, "users", currentUser.uid);
      const buyerDocSnap = await getDoc(buyerDocRef);
      if (buyerDocSnap.exists()) {
        buyerProfile = buyerDocSnap.data() as UserProfile;
      } else {
        console.warn(`Perfil del comprador (UID: ${currentUser.uid}) no encontrado. Usando email como fallback.`);
      }
    } catch (profileError: any) {
      console.error("Error fetching buyer profile:", profileError);
      toast({
        title: "Error al Obtener Perfil (Comprador)",
        description: `No se pudo obtener tu perfil. ${profileError.message} (Code: ${profileError.code})`,
        variant: "destructive",
        duration: 7000,
      });
      // Continue, participantInfo will be less complete
    }

    // 2. Get Seller's Profile
    if (product.sellerId) {
        try {
            const sellerDocRef = doc(db, "users", product.sellerId);
            const sellerDocSnap = await getDoc(sellerDocRef);
            if (sellerDocSnap.exists()) {
            sellerProfile = sellerDocSnap.data() as UserProfile;
            } else {
            console.warn(`Perfil del vendedor (UID: ${product.sellerId}) no encontrado. Usando ID como fallback.`);
            }
        } catch (profileError: any) {
            console.error("Error fetching seller profile:", profileError);
            toast({
            title: "Error al Obtener Perfil (Vendedor)",
            description: `No se pudo obtener el perfil del vendedor. ${profileError.message} (Code: ${profileError.code})`,
            variant: "destructive",
            duration: 7000,
            });
            // Continue, participantInfo will be less complete
        }
    }
      
    const participantInfoPayload: Chat['participantInfo'] = {
      [currentUser.uid]: {
        email: buyerProfile?.email || currentUser.email || "Comprador",
        username: buyerProfile?.username || null, // Use null instead of undefined
        profileImageUrl: buyerProfile?.profileImageUrl || null, // Use null instead of undefined
      },
      [product.sellerId]: {
        email: sellerProfile?.email || "Vendedor (Email Desconocido)",
        username: sellerProfile?.username || null, // Use null instead of undefined
        profileImageUrl: sellerProfile?.profileImageUrl || null, // Use null instead of undefined
      }
    };

    const sortedParticipantUids = [currentUser.uid, product.sellerId].sort() as [string, string];
    const chatsRef = collection(db, 'chats');
    let chatId: string;
    

    // 3. Query existing chats for this specific product
    try {
      const q = query(
        chatsRef,
        where('participantUids', '==', sortedParticipantUids),
        where('productContext.productId', '==', product.id) 
      );
      const existingChatQuerySnapshot = await getDocs(q);
      
      if (existingChatQuerySnapshot.empty) {
        // 4. Create new chat
        console.log("No existing chat found for this product. Creating new one.");
        try {
          const newChatDocData: Omit<Chat, 'id'> = {
            participantUids: sortedParticipantUids,
            participantInfo: participantInfoPayload,
            productContext: {
              productId: product.id,
              productName: product.name,
              productImageUrl: product.imageUrl, 
              sellerId: product.sellerId,
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: null,
          };
          const newChatDocRef = await addDoc(chatsRef, newChatDocData);
          chatId = newChatDocRef.id;
          toast({ title: "Chat Iniciado", description: "Has iniciado una conversación con el vendedor.", variant: "default" });
        } catch (createError: any) {
          console.error("Error creating new chat:", createError);
          toast({
            title: "Error al Crear Chat",
            description: `No se pudo crear la conversación. ${createError.message} (Code: ${createError.code})`,
            variant: "destructive",
            duration: 9000,
          });
          setIsContactingSeller(false);
          return;
        }
      } else {
        console.log("Existing chat found for this product. Updating and redirecting.");
        const existingChatDoc = existingChatQuerySnapshot.docs[0];
        chatId = existingChatDoc.id;
        try {
          await updateDoc(existingChatDoc.ref, { 
              updatedAt: serverTimestamp(),
              participantInfo: participantInfoPayload, // Update participantInfo as well
          });
        } catch (updateError: any) {
            console.error("Error updating existing chat:", updateError);
             toast({
                title: "Error al Actualizar Chat",
                description: `No se pudo actualizar el chat existente. ${updateError.message} (Code: ${updateError.code})`,
                variant: "destructive",
                duration: 7000,
            });
            // Continue to router.push even if update fails, as chat exists
        }
        toast({ title: "Chat Existente", description: "Ya tienes una conversación sobre este producto.", variant: "default" });
      }
      router.push(`/chat/${chatId}`);

    } catch (error: any) { 
      console.error("Error initiating chat (query or general):", error);
      toast({ 
        title: "Error al Iniciar Chat", 
        description: `Ocurrió un error inesperado al buscar o iniciar el chat. ${error.message || 'Por favor, inténtalo de nuevo.'} ${error.code ? `(Code: ${error.code})` : ''}`, 
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsContactingSeller(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 mt-4 flex flex-col items-center">
        <Card className="w-full max-w-3xl shadow-xl rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <Skeleton className="aspect-square w-full rounded-lg" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-1/4 mb-2" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-6 w-1/3" />
              <Separator className="my-6" />
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 mt-4 flex flex-col items-center text-center">
        <Card className="w-full max-w-md shadow-xl rounded-lg p-8">
          <ServerCrash className="h-16 w-16 mx-auto text-destructive mb-4" />
          <h2 className="text-2xl font-semibold mb-2 text-destructive">Error</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push('/')} style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la Página Principal
          </Button>
        </Card>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8 mt-4 flex flex-col items-center text-center">
         <Card className="w-full max-w-md shadow-xl rounded-lg p-8">
            <AlertTriangle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-2xl font-semibold mb-2 text-destructive">Producto no Encontrado</h2>
            <p className="text-muted-foreground mb-6">El producto que buscas no está disponible.</p>
            <Button onClick={() => router.push('/')} style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la Página Principal
            </Button>
        </Card>
      </div>
    );
  }

  const displayImageUrl = product.imageUrl
    ? product.imageUrl
    : `https://placehold.co/600x400.png?text=${encodeURIComponent(product.name)}`;

  return (
    <div className="container mx-auto px-4 py-8 mt-4">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver
      </Button>
      <Card className="w-full shadow-xl rounded-lg overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="flex flex-col items-center p-4 md:p-6">
            <div className="relative aspect-square w-full max-w-md mb-4 rounded-lg overflow-hidden shadow-md">
              <Image
                src={displayImageUrl}
                alt={product.name}
                layout="fill"
                objectFit="cover"
                data-ai-hint={product.imageHint || product.name.split(' ').slice(0,2).join(' ').toLowerCase()}
                className={displayImageUrl.startsWith('data:image') ? '' : 'bg-muted'}
              />
            </div>
          </div>
          <div className="p-6 md:p-8 flex flex-col">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-3xl lg:text-4xl font-bold text-foreground">{product.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-grow space-y-4">
              <Badge variant="secondary" className="text-sm">{product.category}</Badge>
              <p className="text-muted-foreground text-base leading-relaxed">
                {product.description}
              </p>
              <p className="text-4xl font-extrabold text-primary mt-2">
                ${product.price.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                Publicado el: {new Date(product.createdAt).toLocaleDateString()}
              </p>
               {product.updatedAt && (
                <p className="text-xs text-muted-foreground">
                  Última actualización: {new Date(product.updatedAt).toLocaleDateString()}
                </p>
              )}
            </CardContent>
            <Separator className="my-6" />
            <div className="mt-auto space-y-3">
              <Button 
                className="w-full text-lg py-3" 
                style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                onClick={() => toast({ title: "Próximamente", description: "La función de compra estará disponible pronto."})}
                disabled={isContactingSeller || (currentUser?.uid === product.sellerId)}
              >
                <ShoppingCart className="mr-2 h-5 w-5" /> Comprar
              </Button>
              <Button 
                variant="outline" 
                className="w-full text-lg py-3"
                onClick={handleContactSeller}
                disabled={isContactingSeller || (currentUser?.uid === product.sellerId)}
              >
                {isContactingSeller ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <MessageSquare className="mr-2 h-5 w-5" />}
                {isContactingSeller ? "Iniciando Chat..." : "Contactar Vendedor"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
