
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Product } from '@/types';
import { recommendProducts, type RecommendProductsInput } from '@/ai/flows/recommend-products';
import { db, auth } from '@/lib/firebase'; 
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';

import { ProductGrid } from '@/components/marketplace/ProductGrid';
import { Filters } from '@/components/marketplace/Filters';
import { SearchBar } from '@/components/marketplace/SearchBar';
import { AiRecommendationsSection } from '@/components/marketplace/AiRecommendationsSection';
import { CreatePostForm, type CreatePostFormValues } from '@/components/marketplace/CreatePostForm';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LogOut, PlusCircle, Home, LayoutGrid, UserCircle, Loader2, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';

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

export default function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  const [currentMaxPrice, setCurrentMaxPrice] = useState(0); 
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]); 
  
  const [aiRecommendedProducts, setAiRecommendedProducts] = useState<Product[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { toast } = useToast();
  const [showCreatePostDialog, setShowCreatePostDialog] = useState(false);
  const router = useRouter();

  const allProductCategories = useMemo(() => {
    if (productsLoading || products.length === 0) return [];
    const categories = Array.from(new Set(products.map(p => p.category))).sort();
    return categories;
  }, [products, productsLoading]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setProductsLoading(true);
    const productsCollection = collection(db, 'products');
    const q = query(productsCollection, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt), 
        updatedAt: doc.data().updatedAt instanceof Timestamp ? doc.data().updatedAt.toDate() : doc.data().updatedAt ? new Date(doc.data().updatedAt) : undefined,
      })) as Product[];
      setProducts(productsData);
      setProductsLoading(false);
    }, (error) => {
      console.error("Error fetching products from Firestore:", error);
      toast({ title: "Error de Carga", description: "No se pudieron cargar los productos. Revisa la consola para más detalles.", variant: "destructive" });
      setProductsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

   useEffect(() => {
    if (products.length === 0 && !productsLoading) {
      setPriceRange([0,0]);
      setCurrentMaxPrice(0);
      return;
    }
    if (productsLoading) return;

    const newTrueMaxProductPrice = Math.max(0, ...products.map(p => p.price));

    if (newTrueMaxProductPrice !== currentMaxPrice) {
      setCurrentMaxPrice(newTrueMaxProductPrice);
      // Reset price range or adjust if new max is lower than current selection
      setPriceRange(prevSelectedRange => {
        if ((prevSelectedRange[0] === 0 && prevSelectedRange[1] === 0 && newTrueMaxProductPrice > 0) || 
            (prevSelectedRange[1] > newTrueMaxProductPrice && newTrueMaxProductPrice > 0) ) {
            return [prevSelectedRange[0], newTrueMaxProductPrice];
        }
        return prevSelectedRange;
      });
    }
  }, [products, productsLoading, currentMaxPrice]);


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

  const filteredProducts = useMemo(() => {
    if (productsLoading) return [];
    let currentProductsList = [...products];

    if (searchQuery.trim()) {
      const lowerSearchQuery = searchQuery.toLowerCase();
      currentProductsList = currentProductsList.filter(product =>
        product.name.toLowerCase().includes(lowerSearchQuery) ||
        product.description.toLowerCase().includes(lowerSearchQuery) ||
        (product.keywords && product.keywords.some(kw => kw.toLowerCase().includes(lowerSearchQuery)))
      );
    }

    if (selectedCategories.length > 0) {
      currentProductsList = currentProductsList.filter(product =>
        selectedCategories.includes(product.category)
      );
    }
    
    if (priceRange[0] <= priceRange[1] && (priceRange[0] > 0 || priceRange[1] < currentMaxPrice) && currentMaxPrice > 0) {
        currentProductsList = currentProductsList.filter(product =>
          product.price >= priceRange[0] && product.price <= priceRange[1]
        );
    }

    return currentProductsList;
  }, [searchQuery, selectedCategories, priceRange, products, productsLoading, currentMaxPrice]);

  const handleSearchSubmit = async () => {
    setHasSearched(true);
    if (!searchQuery.trim() || productsLoading) {
      setAiRecommendedProducts([]);
      return;
    }
    setIsAiLoading(true);
    try {
      const mappedProductsForAi = products.map(p => ({
        name: p.name,
        description: p.description,
        price: p.price,
        category: p.category,
      }));
      
      const aiInput: RecommendProductsInput = {
        searchQuery,
        products: mappedProductsForAi,
        productCategories: allProductCategories,
      };
      const recommendations = await recommendProducts(aiInput);
      
      const fullRecommendedProducts = recommendations.map(recProduct => {
        const found = products.find(p => p.name === recProduct.name && p.category === recProduct.category && p.price === recProduct.price);
        return found ? { ...found } : null; 
      }).filter(p => p !== null) as Product[];

      setAiRecommendedProducts(fullRecommendedProducts);
    } catch (error) {
      console.error("Error fetching AI recommendations:", error);
      setAiRecommendedProducts([]);
       toast({ title: "AI Error", description: "Could not fetch AI recommendations.", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (hasSearched && !searchQuery.trim()) {
      setAiRecommendedProducts([]);
    }
  }, [searchQuery, hasSearched]);

  const handleCreatePost = async (data: CreatePostFormValues, imageFile?: File | null) => { // Un solo imageFile
    if (!currentUser) {
      toast({ title: "Error de Autenticación", description: "Debes iniciar sesión para publicar.", variant: "destructive" });
      return;
    }
    
    let imageUrl = `https://placehold.co/300x200.png?text=${encodeURIComponent(data.name)}`;

    if (imageFile) {
      try {
        const dataUri = await fileToDataUri(imageFile);
        if (dataUri.length > 700 * 1024) { // Approx 700KB for one image as Data URI
             toast({
                title: "Advertencia: Imagen Grande (Data URI)",
                description: "La imagen es grande. Esto podría afectar el rendimiento de Firestore y exceder límites.",
                variant: "default",
                duration: 12000,
            });
        }
        imageUrl = dataUri;
      } catch (error: any) {
          console.error("Error converting file to Data URI (Create Post):", error);
          toast({
              title: "Error al Procesar Imagen",
              description: "No se pudo procesar la imagen. Se usará placeholder.",
              variant: "destructive",
              duration: 9000,
          });
      }
    }

    const productData: Omit<Product, 'id'> = {
      ...data,
      imageUrl, // Single imageUrl
      imageHint: data.name.split(' ').slice(0,2).join(' ').toLowerCase(),
      keywords: data.name.toLowerCase().split(' ').concat(data.category.toLowerCase().split(' ')),
      sellerId: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    console.log("Attempting to save product to Firestore with data:", productData);
    try {
      const productsCollection = collection(db, 'products');
      await addDoc(productsCollection, productData);
      toast({
        title: "¡Publicación Creada!",
        description: `${data.name} ha sido añadido al marketplace.`,
      });
      setShowCreatePostDialog(false); 
    } catch (error: any) {
      console.error("Error creating post in Firestore:", error);
      let firestoreErrorMessage = "No se pudo crear la publicación en la base de datos.";
      if (error.code === 'permission-denied') {
        firestoreErrorMessage = "Error de permisos (permission-denied): No se pudo crear la publicación. Verifica tus REGLAS DE FIRESTORE.";
      } else if (error.message && error.message.toLowerCase().includes("document exceeds the maximum size")) {
        firestoreErrorMessage = "Error: El tamaño de los datos (probablemente la imagen) excede el límite de Firestore. Intenta con una imagen más pequeña.";
      } else if (error.code) {
        firestoreErrorMessage += ` (Código: ${error.code})`;
      }
      toast({ 
        title: "Error al Publicar en BD", 
        description: firestoreErrorMessage, 
        variant: "destructive",
        duration: 15000, 
      });
    }
  };
  
  const handleCategoryToggle = useCallback((categoryToToggle: string) => {
    setSelectedCategories(prevSelectedCategories =>
      prevSelectedCategories.includes(categoryToToggle)
        ? prevSelectedCategories.filter(c => c !== categoryToToggle)
        : [...prevSelectedCategories, categoryToToggle]
    );
  }, []);


  return (
    <>
      <header className="sticky top-0 z-50 shadow-md" style={{ backgroundColor: 'hsl(var(--dark-background))', color: 'hsl(var(--dark-foreground))' }}>
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold" style={{ color: 'hsl(var(--primary))' }}>
            kenneth jimenez
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/" className="hover:text-primary transition-colors flex items-center">
              <Home className="w-4 h-4 mr-1" /> Home
            </Link>
            <Link href="#" className="hover:text-primary transition-colors flex items-center opacity-50 cursor-not-allowed">
              <LayoutGrid className="w-4 h-4 mr-1" /> Categorías
            </Link>
          </nav>
          <div className="flex items-center space-x-2 sm:space-x-3">
            {authLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : currentUser ? (
              <>
                <Dialog open={showCreatePostDialog} onOpenChange={setShowCreatePostDialog}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="sm" style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Vender
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[525px]" id="create-post">
                    <DialogHeader>
                      <DialogTitle>Crear Nueva Publicación</DialogTitle>
                    </DialogHeader>
                    <CreatePostForm 
                      allCategories={allProductCategories.length > 0 ? allProductCategories : ['General', 'Otros']}
                      onSubmit={handleCreatePost} 
                      onCancel={() => setShowCreatePostDialog(false)}
                      isEditing={false}
                    />
                  </DialogContent>
                </Dialog>
                 <Button variant="ghost" size="sm" asChild className="hover:text-primary">
                  <Link href="/chat" className="flex items-center">
                    <MessageSquare className="mr-1 h-4 w-4" />
                    Chat
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild className="hover:text-primary">
                  <Link href="/profile" className="flex items-center">
                    <UserCircle className="mr-1 h-4 w-4" />
                    Mi Perfil
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout} style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' }} className="hover:bg-primary/10">
                  <LogOut className="mr-0 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Cerrar Sesión</span>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild className="hover:text-primary">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button variant="default" size="sm" asChild style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 mt-4">
        <div className="mb-8">
          <SearchBar 
            searchQuery={searchQuery} 
            setSearchQuery={setSearchQuery} 
            onSearchSubmit={handleSearchSubmit}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <aside className="md:col-span-1">
            <div className="sticky top-24 space-y-6">
              <Filters
                allCategories={allProductCategories}
                selectedCategories={selectedCategories}
                setSelectedCategories={handleCategoryToggle} 
                priceRange={priceRange}
                setPriceRange={setPriceRange}
                maxPrice={currentMaxPrice}
                isLoading={productsLoading && allProductCategories.length === 0}
              />
            </div>
          </aside>

          <main className="md:col-span-3">
            <AiRecommendationsSection 
              products={aiRecommendedProducts} 
              isLoading={isAiLoading}
              hasSearched={hasSearched}
            />
            
            {hasSearched && aiRecommendedProducts.length > 0 && <Separator className="my-8" />}
            
            <section className="py-8">
              <h2 className="text-2xl font-bold mb-6 text-foreground">
                {productsLoading 
                  ? 'Cargando Productos...' 
                  : searchQuery.trim() || selectedCategories.length > 0 || (priceRange[0] > 0 || priceRange[1] < currentMaxPrice && currentMaxPrice > 0)
                    ? 'Productos Filtrados' 
                    : 'Todos los Productos'}
              </h2>
              {productsLoading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
              ) : (
                <ProductGrid 
                    products={filteredProducts} 
                    emptyStateMessage={
                        (searchQuery.trim() || selectedCategories.length > 0 || (priceRange[0] > 0 || priceRange[1] < currentMaxPrice && currentMaxPrice > 0))
                        ? "No hay productos que coincidan con tus filtros." 
                        : "Aún no hay productos publicados. ¡Sé el primero!"
                    } 
                />
              )}
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
