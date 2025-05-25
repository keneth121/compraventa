
"use client";

import { useEffect, useState, useCallback, useMemo, useRef, type ChangeEvent } from 'react'; 
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase'; 
import { signOut, type User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, updateDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import type { Product, UserProfile } from '@/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Edit3, ShoppingBag, MessageSquareText, LogOut, Home, Loader2, PackageSearch, UploadCloud } from 'lucide-react'; 
import Link from 'next/link';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreatePostForm, type CreatePostFormValues } from '@/components/marketplace/CreatePostForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

// Helper function to convert file to Data URI
const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsDataURL(file);
  });
};

const MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB for profile (stricter for Data URI)
const ACCEPTED_PROFILE_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfileData, setUserProfileData] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  
  const [userProducts, setUserProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showEditProductDialog, setShowEditProductDialog] = useState(false);
  const [productToDeleteId, setProductToDeleteId] = useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);

  const profileImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        router.push('/login');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (currentUser && !authLoading) {
      setProfileLoading(true);
      const userDocRef = doc(db, "users", currentUser.uid);
      const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserProfileData({
            uid: docSnap.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt ? new Date(data.updatedAt) : undefined,
          } as UserProfile);
        } else {
          console.warn("Perfil de usuario no encontrado en Firestore para UID:", currentUser.uid);
          setUserProfileData(null);
        }
        setProfileLoading(false);
      }, (error) => {
        console.error("Error fetching user profile:", error);
        toast({ title: "Error de Perfil", description: "No se pudo cargar la información del perfil.", variant: "destructive" });
        setUserProfileData(null);
        setProfileLoading(false);
      });
      return () => unsubscribeProfile();
    } else if (!authLoading && !currentUser) {
      setProfileLoading(false);
    }
  }, [currentUser, authLoading, toast]);

  const userProductCategories = useMemo(() => {
    if (productsLoading || userProducts.length === 0) return ['General', 'Otros'];
    const categories = Array.from(new Set(userProducts.map(p => p.category))).sort();
    return categories.length > 0 ? categories : ['General', 'Otros'];
  }, [userProducts, productsLoading]);


  useEffect(() => {
    if (currentUser) {
      setProductsLoading(true);
      const productsCollection = collection(db, 'products');
      const q = query(
        productsCollection,
        where('sellerId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const productsData = querySnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt instanceof Timestamp ? docSnap.data().createdAt.toDate() : new Date(docSnap.data().createdAt),
          updatedAt: docSnap.data().updatedAt instanceof Timestamp ? docSnap.data().updatedAt.toDate() : docSnap.data().updatedAt ? new Date(docSnap.data().updatedAt) : undefined,
        })) as Product[];
        setUserProducts(productsData);
        setProductsLoading(false);
      }, (error) => {
        console.error("Error fetching user products:", error);
        toast({ title: "Error", description: "No se pudieron cargar tus productos. Revisa las reglas de Firestore y los índices.", variant: "destructive" });
        setProductsLoading(false);
      });

      return () => unsubscribe();
    }
  }, [currentUser, toast]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Sesión Cerrada", description: "Has cerrado sesión exitosamente.", variant: "default" });
      router.push('/');
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      toast({ title: "Error", description: "No se pudo cerrar sesión. Inténtalo de nuevo.", variant: "destructive" });
    }
  };
  
  const handleEditProductClick = (product: Product) => {
    setEditingProduct(product);
    setShowEditProductDialog(true);
  };

  const handleDeleteProductClick = (productId: string) => {
    setProductToDeleteId(productId);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDeleteId || !currentUser) return;
    const productRef = doc(db, 'products', productToDeleteId);
    
    try {
      await deleteDoc(productRef);
      toast({
        title: "Producto Eliminado",
        description: "El producto ha sido eliminado exitosamente.",
        variant: "default"
      });
    } catch (error: any) {
      console.error("Error deleting product from Firestore:", error);
      toast({
        title: "Error al Eliminar de BD",
        description: `No se pudo eliminar el producto de la base de datos. ${error.code ? `(Código: ${error.code})` : ''}`,
        variant: "destructive",
        duration: 9000,
      });
    } finally {
      setShowDeleteConfirmDialog(false);
      setProductToDeleteId(null);
    }
  };
  
  const handleUpdateSubmittedProduct = async (data: CreatePostFormValues, imageFile?: File | null) => { // Un solo imageFile
    if (!editingProduct || !currentUser) {
        toast({ title: "Error de Actualización", description: "No se pudo identificar el producto a editar o el usuario.", variant: "destructive" });
        return;
    }
    const productRef = doc(db, 'products', editingProduct.id);
    let newImageUrl = editingProduct.imageUrl; // Conservar imagen anterior por defecto

    if (imageFile) {
      try {
        const dataUri = await fileToDataUri(imageFile);
        if (dataUri.length > 700 * 1024) { 
          toast({
            title: "Advertencia: Imagen Grande (Data URI)",
            description: "La nueva imagen es grande. Esto podría afectar Firestore. Considere usar una imagen más pequeña.",
            variant: "default",
            duration: 12000,
          });
        }
        newImageUrl = dataUri;
      } catch (error: any) {
        console.error("Error converting file to Data URI (Update Post):", error);
        toast({
          title: "Error al Procesar Nueva Imagen",
          description: "No se pudo procesar la nueva imagen. Se conservará la imagen anterior.",
          variant: "destructive",
          duration: 9000,
        });
      }
    }

    const updatedProductData: Partial<Product> = { 
      name: data.name,
      description: data.description,
      price: data.price,
      category: data.category,
      imageUrl: newImageUrl,
      imageHint: editingProduct.imageHint || data.name.split(' ').slice(0,2).join(' ').toLowerCase(),
      keywords: data.name.toLowerCase().split(' ').concat(data.category.toLowerCase().split(' ')),
      updatedAt: serverTimestamp(),
    };
    
    try {
      await updateDoc(productRef, updatedProductData);
      toast({
        title: "Producto Actualizado",
        description: `${data.name} ha sido actualizado exitosamente.`,
      });
      setShowEditProductDialog(false);
      setEditingProduct(null);
    } catch (error: any) {
      console.error("Error updating product in Firestore:", error);
      let firestoreErrorMessage = "No se pudo actualizar el producto en la base de datos.";
      if (error.code === 'permission-denied') {
        firestoreErrorMessage = "Error de permisos (permission-denied). Verifica tus REGLAS DE FIRESTORE.";
      } else if (error.message && error.message.toLowerCase().includes("document exceeds the maximum size")) {
        firestoreErrorMessage = "Error: El tamaño de los datos (probablemente la imagen) excede el límite de Firestore. Intenta con una imagen más pequeña.";
      } else if (error.code) {
        firestoreErrorMessage += ` (Código: ${error.code})`;
      }
      toast({ 
        title: "Error al Actualizar en BD", 
        description: firestoreErrorMessage, 
        variant: "destructive",
        duration: 15000,
      });
    }
  };

  const handleProfileImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!currentUser) {
      toast({ title: "Error", description: "Debes iniciar sesión para cambiar tu foto.", variant: "destructive" });
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      toast({ title: "Archivo Demasiado Grande", description: `La imagen no puede exceder ${MAX_PROFILE_IMAGE_SIZE / (1024 * 1024)}MB.`, variant: "destructive" });
      if(profileImageInputRef.current) profileImageInputRef.current.value = "";
      return;
    }
    if (!ACCEPTED_PROFILE_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "Tipo de Archivo No Válido", description: "Solo se aceptan imágenes JPG, PNG, WEBP.", variant: "destructive" });
      if(profileImageInputRef.current) profileImageInputRef.current.value = "";
      return;
    }

    try {
      const dataUri = await fileToDataUri(file);
      if (dataUri.length > 200 * 1024) { 
        toast({
          title: "Advertencia: Imagen de Perfil Grande",
          description: "La imagen es grande para ser guardada como Data URI. Se recomienda usar imágenes más pequeñas (idealmente < 200KB).",
          variant: "default",
          duration: 9000,
        });
      }

      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, {
        profileImageUrl: dataUri,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Foto de Perfil Actualizada", description: "Tu foto de perfil ha sido cambiada.", variant: "default" });
    } catch (error: any) {
      console.error("Error al subir foto de perfil (Data URI):", error);
      toast({ title: "Error al Subir Foto", description: "No se pudo actualizar tu foto de perfil.", variant: "destructive" });
    } finally {
        if(profileImageInputRef.current) {
            profileImageInputRef.current.value = "";
        }
    }
  };

  const getProfileInitial = () => {
    if (userProfileData?.username) return userProfileData.username.charAt(0).toUpperCase();
    if (currentUser?.email) return currentUser.email.charAt(0).toUpperCase();
    return "U";
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-lg">Autenticando...</p>
      </div>
    );
  }

  if (!currentUser) {
    // Esto no debería suceder si authLoading es false y el useEffect de auth redirige.
    // Pero es una salvaguarda.
    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <p className="text-lg text-destructive">Error: Usuario no autenticado. Por favor, inicia sesión.</p>
            <Button onClick={() => router.push('/login')} className="ml-4">Ir a Login</Button>
        </div>
    );
  }

  return (
    <>
      <input
        type="file"
        ref={profileImageInputRef}
        onChange={handleProfileImageChange}
        accept={ACCEPTED_PROFILE_IMAGE_TYPES.join(",")}
        className="hidden"
        id="profile-image-upload"
      />
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-50 shadow-md" style={{ backgroundColor: 'hsl(var(--dark-background))', color: 'hsl(var(--dark-foreground))' }}>
          <div className="container mx-auto px-4 py-3 flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold" style={{ color: 'hsl(var(--primary))' }}>
              kenneth jimenez
            </Link>
            <nav className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" asChild className="hover:text-primary">
                <Link href="/" className="flex items-center"><Home className="mr-1 h-4 w-4" /> Home</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' }} className="hover:bg-primary/10">
                <LogOut className="mr-0 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </Button>
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 mt-4 flex-grow">
          <Card className="w-full max-w-4xl mx-auto shadow-xl rounded-lg">
            <CardHeader className="text-center pb-4">
              <div className="relative mx-auto mb-3">
                <Avatar className="h-24 w-24 mx-auto text-primary mb-1">
                  {profileLoading ? (
                    <Skeleton className="h-full w-full rounded-full" />
                  ) : (
                    <>
                      <AvatarImage src={userProfileData?.profileImageUrl} alt={userProfileData?.username || "Usuario"} data-ai-hint="profile photo"/>
                      <AvatarFallback className="text-3xl bg-muted">
                        {getProfileInitial()}
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="absolute bottom-0 right-0 rounded-full h-8 w-8 border-2 border-background bg-muted hover:bg-primary/10" 
                  onClick={() => profileImageInputRef.current?.click()} 
                  title="Cambiar foto de perfil"
                  disabled={profileLoading}
                >
                    <UploadCloud className="h-4 w-4 text-primary" />
                    <span className="sr-only">Cambiar foto de perfil</span>
                </Button>
              </div>
              
              {profileLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-48 mx-auto" />
                    <Skeleton className="h-4 w-64 mx-auto" />
                  </div>
                ) : userProfileData ? (
                  <>
                    <CardTitle className="text-3xl font-bold text-foreground">
                      {userProfileData.firstName} {userProfileData.lastName}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      @{userProfileData.username} &bull; {userProfileData.email}
                    </CardDescription>
                  </>
                ) : currentUser.email ? ( // Fallback si no hay userProfileData pero sí currentUser
                  <>
                    <CardTitle className="text-3xl font-bold text-foreground">
                        {currentUser.email}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Información de perfil (nombre, etc.) no encontrada. <br/> Esto puede ocurrir si la cuenta se creó antes de solicitar estos datos.
                        Intenta <Link href="/signup" className="text-primary hover:underline">registrarte de nuevo</Link> con el mismo email o contacta a soporte.
                    </CardDescription>
                  </>
                ) : (
                    <CardTitle className="text-3xl font-bold text-foreground">
                        Perfil de Usuario
                    </CardTitle>
                )
              }
            </CardHeader>
            <CardContent className="space-y-8 pt-2">
              <section>
                <h3 className="text-xl font-semibold mb-4 text-foreground border-b pb-2">Información de la Cuenta</h3>
                {profileLoading ? (
                    <div className="space-y-2 text-sm">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                ) : userProfileData ? (
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Nombre Completo:</span> {userProfileData.firstName} {userProfileData.lastName}</p>
                    <p><span className="font-medium">Nombre de Usuario:</span> @{userProfileData.username}</p>
                    <p><span className="font-medium">Email:</span> {userProfileData.email}</p>
                  </div>
                ) : ( // Si userProfileData es null pero currentUser existe
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Email:</span> {currentUser.email}</p>
                    <p className="text-muted-foreground italic">No se encontró información adicional del perfil (nombre, apellido, nombre de usuario). Esto puede ocurrir si la cuenta se creó antes de que se solicitaran estos datos o si hubo un problema al guardar el perfil durante el registro.</p>
                     <Link href="/signup" className="text-primary hover:underline">
                        Intenta registrarte de nuevo
                    </Link>
                     o contacta a soporte.
                  </div>
                )}
                <Button variant="outline" className="mt-4 w-full sm:w-auto" onClick={() => toast({ title: "Próximamente", description: "La edición de información del perfil estará disponible pronto."})}>
                  <Edit3 className="mr-2 h-4 w-4" /> Editar Información (Próximamente)
                </Button>
              </section>

              <Separator />

              <section>
                <h3 className="text-xl font-semibold mb-4 text-foreground border-b pb-2 flex items-center">
                  <ShoppingBag className="mr-3 h-5 w-5 text-primary" />
                  Mis Publicaciones / Panel de Vendedor
                </h3>
                {productsLoading ? (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="ml-2">Cargando tus productos...</p>
                  </div>
                ) : userProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userProducts.map(product => (
                      <ProductCard 
                        key={product.id} 
                        product={product}
                        onEditProduct={handleEditProductClick}
                        onDeleteProduct={handleDeleteProductClick}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <PackageSearch className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                    <p className="mb-2 text-lg">Aún no has publicado ningún producto.</p>
                     <Button asChild style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                       <Link href="/#create-post">¡Empieza a Vender!</Link>
                    </Button>
                  </div>
                )}
              </section>
              
              <Separator />

              <section>
                <h3 className="text-xl font-semibold mb-4 text-foreground border-b pb-2 flex items-center">
                  <MessageSquareText className="mr-3 h-5 w-5 text-primary" />
                  Mis Chats
                </h3>
                 <Link href="/chat" passHref>
                  <Button variant="default" className="w-full sm:w-auto" style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                    Ver Mis Chats
                  </Button>
                </Link>
              </section>
            </CardContent>
          </Card>
        </main>
      </div>

      <Dialog open={showEditProductDialog} onOpenChange={(isOpen) => {
          setShowEditProductDialog(isOpen);
          if (!isOpen) setEditingProduct(null); 
      }}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Editar Publicación</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <CreatePostForm 
              allCategories={userProductCategories}
              onSubmit={handleUpdateSubmittedProduct}
              onCancel={() => {
                setShowEditProductDialog(false);
                setEditingProduct(null);
              }}
              defaultValues={editingProduct}
              isEditing={true}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el producto de la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirmDialog(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProduct} style={{ backgroundColor: 'hsl(var(--destructive))', color: 'hsl(var(--destructive-foreground))' }}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
