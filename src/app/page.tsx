import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="relative w-full h-screen">
        <Image
          src="/homepicture.webp"
          alt="Home picture"
          fill
          className="object-cover"
          priority
        />
      </div>
    </div>
  );
}
