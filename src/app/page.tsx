import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">    
      <div className="relative w-full h-screen">
        <Image
          src="/homepicture2.jpg"          
          alt="Home picture"
          fill
          className="object-contain"          
          priority
        />
      </div>
    </div>
  );
}
