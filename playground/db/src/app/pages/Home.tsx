import { addTestimonial } from "@/app/actions";
import { SubmitButton } from "@/app/components/SubmitButton";
import { db } from "@/db/db";

async function getTestimonials() {
  return await db
    .selectFrom("testimonials")
    .innerJoin("users", "users.id", "testimonials.userId")
    .innerJoin(
      "testimonial_statuses",
      "testimonial_statuses.id",
      "testimonials.statusId",
    )
    .select([
      "testimonials.id",
      "testimonials.content",
      "users.username as author",
      "testimonial_statuses.name as status",
    ])
    .orderBy("testimonials.createdAt", "desc")
    .execute();
}

export async function Home() {
  const testimonials = await getTestimonials();

  return (
    <div className="container">
      <h1>Testimonials</h1>
      <form
        action={async (formData: FormData) => {
          "use server";
          await addTestimonial(formData.get("content") as string);
        }}
      >
        <textarea
          name="content"
          placeholder="Share your experience..."
          required
        />
        <SubmitButton />
      </form>
      <div className="testimonial-list">
        {testimonials.map((testimonial) => (
          <div key={testimonial.id} className="testimonial-card">
            <p>"{testimonial.content}"</p>
            <small>
              - {testimonial.author} (Status: {testimonial.status})
            </small>
          </div>
        ))}
        {testimonials.length === 0 && (
          <p>No testimonials yet. Be the first to add one!</p>
        )}
      </div>
    </div>
  );
}
