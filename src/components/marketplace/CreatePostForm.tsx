
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, type ChangeEvent, useEffect } from "react";
import NextImage from "next/image";
import type { Product } from '@/types';
import { XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE_PER_IMAGE = 5 * 1024 * 1024; // 5MB per image (still large for Data URI)
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const createPostFormSchema = z.object({
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }).max(100, { message: "El nombre no puede exceder los 100 caracteres." }),
  description: z.string().min(10, { message: "La descripción debe tener al menos 10 caracteres." }).max(1000, { message: "La descripción no puede exceder los 1000 caracteres." }),
  price: z.coerce.number().positive({ message: "El precio debe ser un número positivo." }),
  category: z.string({ required_error: "Por favor selecciona una categoría." }).min(1, { message: "Por favor selecciona una categoría válida."}),
});

export type CreatePostFormValues = z.infer<typeof createPostFormSchema>;

interface CreatePostFormProps {
  allCategories: string[];
  onSubmit: (values: CreatePostFormValues, imageFile?: File | null) => Promise<void>; // Un solo archivo opcional
  onCancel: () => void;
  defaultValues?: Partial<Product>;
  isEditing?: boolean;
}

export function CreatePostForm({ allCategories, onSubmit, onCancel, defaultValues, isEditing = false }: CreatePostFormProps) {
  const { toast } = useToast();
  const [imagePreview, setImagePreview] = useState<string | null>(null); // Un solo preview
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null); // Un solo archivo
  const [imageError, setImageError] = useState<string | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const form = useForm<CreatePostFormValues>({
    resolver: zodResolver(createPostFormSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      description: defaultValues?.description || "",
      price: defaultValues?.price || 0,
      category: defaultValues?.category || "",
    },
  });
  
  useEffect(() => {
    form.reset({
      name: defaultValues?.name || "",
      description: defaultValues?.description || "",
      price: defaultValues?.price || 0,
      category: defaultValues?.category || "",
    });
    if (defaultValues?.imageUrl) { // Usar imageUrl (string)
      setImagePreview(defaultValues.imageUrl);
    } else {
      setImagePreview(null);
    }
    setSelectedImageFile(null);
    setImageError(null);
  }, [defaultValues, form]);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; // Tomar solo el primer archivo
    setImageError(null);
    setImagePreview(null); // Limpiar preview anterior
    setSelectedImageFile(null); // Limpiar archivo seleccionado anterior

    if (file) {
      if (file.size > MAX_FILE_SIZE_PER_IMAGE) {
        setImageError(`El archivo es demasiado grande. Máximo ${MAX_FILE_SIZE_PER_IMAGE / (1024*1024)}MB.`);
        if(event.target) event.target.value = "";
        return;
      }
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setImageError(`Tipo de archivo no válido. Solo se aceptan JPG, PNG, WEBP.`);
        if(event.target) event.target.value = "";
        return;
      }
      
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    if(event.target) event.target.value = "";
  };

  const removeImage = () => {
    setImagePreview(null);
    setSelectedImageFile(null);
    setImageError(null);
    // Es importante resetear el valor del input de archivo si el usuario quiere volver a seleccionar el mismo
    const fileInput = document.getElementById('product-image-upload') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = "";
    }
  };

  const submitHandler = async (values: CreatePostFormValues) => {
    setIsSubmittingForm(true);
    setImageError(null);

    if (!isEditing && !selectedImageFile && !defaultValues?.imageUrl) {
      setImageError("Debes subir una imagen para una nueva publicación.");
      setIsSubmittingForm(false);
      return;
    }
    
    try {
      await onSubmit(values, selectedImageFile);
      if (!isEditing) {
          form.reset({ name: "", description: "", price: 0, category: ""});
          removeImage();
      }
    } catch (error) {
        console.error("Error in form submission process:", error);
        setImageError("Hubo un error al procesar el formulario. Inténtalo de nuevo.");
    } finally {
      setIsSubmittingForm(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitHandler)} className="space-y-6 py-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Producto</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Camiseta de algodón orgánico" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe tu producto detalladamente..."
                  className="resize-none"
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Precio ($)</FormLabel>
                <FormControl>
                    <Input type="number" placeholder="Ej: 29.99" {...field} step="0.01" min="0"/>
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Categoría</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    {allCategories
                        .filter(category => category && category.trim() !== '') 
                        .map(category => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                     {allCategories.length === 0 && <SelectItem value="General" disabled>No hay categorías</SelectItem>}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        
        <FormItem>
          <FormLabel>Imagen del Producto</FormLabel>
          <FormControl>
            <Input 
              id="product-image-upload" // Añadido ID para poder resetearlo
              type="file" 
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              onChange={handleImageChange} 
              className="file:text-primary file:font-medium"
              key={defaultValues?.id || 'new-product-image'} // No multiple
            />
          </FormControl>
          {imageError && <FormMessage>{imageError}</FormMessage>}
          {imagePreview && (
            <div className="mt-4 relative group w-40 h-40 aspect-square rounded-md overflow-hidden border">
              <NextImage src={imagePreview} alt="Vista previa" layout="fill" objectFit="cover" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-75 group-hover:opacity-100"
                onClick={removeImage}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          )}
          <FormDescription>
            Sube una imagen para tu producto (JPG, PNG, WEBP, máx. {MAX_FILE_SIZE_PER_IMAGE / (1024*1024)}MB).
            {isEditing ? " Si no subes una nueva imagen, se conservará la actual." : ""}
          </FormDescription>
        </FormItem>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmittingForm}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmittingForm || form.formState.isSubmitting} style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
            {isSubmittingForm 
              ? (isEditing ? "Actualizando..." : "Publicando...") 
              : (isEditing ? "Actualizar Publicación" : "Crear Publicación")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
