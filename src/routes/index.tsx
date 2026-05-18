import { createFileRoute } from "@tanstack/react-router";
import { PhotosVideosApp } from "@/components/PhotosVideosApp";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <>
      <PhotosVideosApp />
      <Toaster richColors position="top-right" />
    </>
  );
}
