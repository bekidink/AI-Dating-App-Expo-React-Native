import { useMutation } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { useCallback } from "react";

import { api } from "@/convex/_generated/api";
import { hapticButtonPress, hapticSelection } from "@/lib/haptics";
import { Platform } from "react-native";

interface UsePhotoPickerOptions {
  maxPhotos?: number;
  aspect?: [number, number];
  quality?: number;
}

interface UsePhotoPickerReturn {
  /** Pick an image from the library. Returns the local URI or null if cancelled/failed. */
  pickImage: () => Promise<string | null>;
  /** Upload a local image URI to Convex storage. Returns the storage ID. */
  uploadPhoto: (uri: string) => Promise<string>;
  /** Upload multiple photos in parallel. Returns array of storage IDs. */
  uploadPhotos: (uris: string[]) => Promise<string[]>;
}

/**
 * Hook for picking and uploading photos to Convex storage.
 * Encapsulates permission handling, image picker, and upload logic.
 */
export function usePhotoPicker(options: UsePhotoPickerOptions = {}): UsePhotoPickerReturn {
  const { maxPhotos = 6, aspect = [3, 4], quality = 0.8 } = options;

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  
 console.log("r", generateUploadUrl());

  const pickImage = useCallback(async (): Promise<string | null> => {
    hapticSelection();

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert("Permission to access photos is required!");
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect,
      quality,
    });

    if (!result.canceled && result.assets[0]) {
      console.log(result.assets[0].uri);
      hapticButtonPress();
      return result.assets[0].uri;
    }

    return null;
  }, [aspect, quality]);

  const uploadPhoto = useCallback(
    async (uri: string): Promise<string> => {
      const uploadUrl = await generateUploadUrl();
      console.log("Upload URL:", uploadUrl);

      // Detect platform
      const isAndroid = Platform.OS === "android";

      let body: BodyInit;
      let headers: Record<string, string> = {};

      if (isAndroid) {
        // Preferred on Android: send raw URI in FormData (avoids Blob fetch/XHR issues)
        const formData = new FormData();
        const fileName = uri.split("/").pop() || `photo-${Date.now()}.jpg`;

        // Guess MIME type from extension (or default to jpeg since expo-image-picker usually returns jpg)
        let mimeType = "image/jpeg";
        if (uri.endsWith(".png")) mimeType = "image/png";
        if (uri.endsWith(".heic") || uri.endsWith(".heif"))
          mimeType = "image/heic";

        formData.append("file", {
          uri,
          name: fileName,
          type: mimeType,
        } as any); // TypeScript needs the 'as any' cast here

        body = formData;
        // IMPORTANT: Do NOT set 'Content-Type' header manually for FormData!
        // fetch adds the correct multipart/form-data + boundary automatically
      } else {
        // On iOS / web: you can keep Blob approach if it works, or use same FormData
        // But for consistency, use FormData everywhere
        const formData = new FormData();
        const fileName = uri.split("/").pop() || `photo-${Date.now()}.jpg`;
        let mimeType = "image/jpeg";
        if (uri.endsWith(".png")) mimeType = "image/png";

        formData.append("file", {
          uri,
          name: fileName,
          type: mimeType,
        } as any);

        body = formData;
      }

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body,
        headers,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse
          .text()
          .catch(() => "Unknown error");
        console.error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      const { storageId } = await uploadResponse.json();
      console.log("Storage ID received:", storageId);
      return storageId;
    },
    [generateUploadUrl],
  );

  const uploadPhotos = useCallback(
    (uris: string[]): Promise<string[]> => Promise.all(uris.map(uploadPhoto)),
    []
  );

  return { pickImage, uploadPhoto, uploadPhotos };
}
