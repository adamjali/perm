"use client";

/**
 * ContactSection Component
 *
 * Contact form and link cards section for the home page.
 * 2-column layout on desktop (form left, cards right), stacked on mobile.
 *
 * Features:
 * - Contact form with name, email, message fields
 * - Client-side validation with inline error messages
 * - mailto: fallback for form submission
 * - Contact link cards (Email Support, Documentation)
 * - Neobrutalist styling matching design system
 * - ScrollReveal entrance animations
 * - Dark mode support
 *
 */

import * as React from "react";
import { Mail, Bug, Lightbulb, CheckCircle, AlertCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const SUPPORT_EMAIL = "support@permtracker.app";
const MIN_MESSAGE_LENGTH = 10;

interface FormData {
  name: string;
  email: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateForm(data: FormData): FormErrors {
  const errors: FormErrors = {};

  if (!data.name.trim()) {
    errors.name = "Name is required";
  }

  if (!data.email.trim()) {
    errors.email = "Email is required";
  } else if (!validateEmail(data.email.trim())) {
    errors.email = "Please enter a valid email address";
  }

  if (!data.message.trim()) {
    errors.message = "Message is required";
  } else if (data.message.trim().length < MIN_MESSAGE_LENGTH) {
    errors.message = `Message must be at least ${MIN_MESSAGE_LENGTH} characters`;
  }

  return errors;
}

interface ContactLinkCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  external?: boolean;
}

function ContactLinkCard({
  href,
  icon,
  title,
  subtitle,
  external = false,
}: ContactLinkCardProps) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group flex items-center gap-4 p-4 border-2 border-border bg-card dark:border-white/20 shadow-hard-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard hover:border-primary active:translate-y-0 active:shadow-hard-sm"
    >
      <div className="p-3 border-2 border-border bg-primary shadow-hard-sm dark:border-white/20 transition-transform duration-150 group-hover:scale-105">
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "h-6 w-6 text-black" })}
      </div>
      <div>
        <span className="font-heading font-bold text-sm block group-hover:text-primary transition-colors duration-150">{title}</span>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
    </a>
  );
}

interface FormFieldWrapperProps {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function FormFieldWrapper({
  label,
  name,
  required,
  error,
  children,
}: FormFieldWrapperProps) {
  return (
    <div className="flex flex-col space-y-1.5">
      {/* Label */}
      <label htmlFor={name} className="font-semibold text-sm">
        {label}
        {required && (
          <span className="text-destructive ml-1 font-bold" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {/* Input with shake animation on error */}
      <div className={cn("transition-all duration-200", error && "animate-shake")}>
        {children}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-1.5 animate-fade-in">
          <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
          <p
            id={`${name}-error`}
            role="alert"
            className="text-sm font-medium text-destructive"
          >
            {error}
          </p>
        </div>
      )}
    </div>
  );
}

export function ContactSection() {
  // Form state
  const [formData, setFormData] = React.useState<FormData>({
    name: "",
    email: "",
    message: "",
  });
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [isSuccess, setIsSuccess] = React.useState(false);

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error for this field when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }

    // Clear success message when user starts new input
    if (isSuccess) {
      setIsSuccess(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate form
    const validationErrors = validateForm(formData);
    setErrors(validationErrors);

    // If validation fails, don't proceed
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    // Construct mailto URL
    const subject = encodeURIComponent(`Contact from ${formData.name.trim()}`);
    const body = encodeURIComponent(
      `${formData.message.trim()}\n\nFrom: ${formData.email.trim()}`
    );
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

    // Open mailto link
    window.location.href = mailtoUrl;

    // Show success message and reset form
    setIsSuccess(true);
    setFormData({ name: "", email: "", message: "" });
    setErrors({});
  };

  // Handle keyboard submission (Enter in last field)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) form.requestSubmit();
    }
  };

  return (
    <section id="contact" className="relative bg-muted/30">
      {/* Content container */}
      <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-8 sm:py-28">
        {/* Section header */}
        <ScrollReveal direction="up" className="mb-12 text-center sm:mb-16">
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Get in Touch
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            Questions, feedback, or just want to say hello?
          </p>
        </ScrollReveal>

        {/* Two-column layout */}
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Left column - Contact form */}
          <ScrollReveal direction="left" delay={0.1}>
            <div className="bg-card border-2 border-border p-6 sm:p-8 shadow-hard dark:border-white/20">

              <h3 className="font-heading font-bold text-lg mb-6">
                Send us a message
              </h3>

              {/* Success message */}
              {isSuccess && (
                <div className="flex items-center gap-2 mb-6 p-4 bg-primary/10 border-2 border-primary/20 animate-fade-in">
                  <CheckCircle className="size-5 text-primary shrink-0" />
                  <p className="text-sm font-medium text-foreground">
                    Your email client should open shortly. If it doesn&apos;t, please
                    email us directly at {SUPPORT_EMAIL}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* Name field */}
                <FormFieldWrapper
                  label="Name"
                  name="name"
                  required
                  error={errors.name}
                >
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your name"
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "name-error" : undefined}
                    autoComplete="name"
                  />
                </FormFieldWrapper>

                {/* Email field */}
                <FormFieldWrapper
                  label="Email"
                  name="email"
                  required
                  error={errors.email}
                >
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    autoComplete="email"
                  />
                </FormFieldWrapper>

                {/* Message field */}
                <FormFieldWrapper
                  label="Message"
                  name="message"
                  required
                  error={errors.message}
                >
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="How can we help?"
                    rows={4}
                    aria-invalid={!!errors.message}
                    aria-describedby={errors.message ? "message-error" : undefined}
                  />
                </FormFieldWrapper>

                {/* Submit button */}
                <Button type="submit" className="w-full">
                  <Send className="size-4" />
                  Send Message
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Press Cmd/Ctrl + Enter to send
                </p>
              </form>
            </div>
          </ScrollReveal>

          {/* Right column - Contact link cards */}
          <ScrollReveal direction="right" delay={0.2}>
            <div className="flex flex-col gap-4">
              <h3 className="font-heading font-bold text-lg mb-2">
                Other ways to reach us
              </h3>

              {/* Report a Bug card */}
              <ContactLinkCard
                href="https://github.com"
                icon={<Bug className="h-6 w-6 text-primary" />}
                title="Report a Bug"
                subtitle="Found an issue? Let us know on GitHub"
                external
              />

              {/* Request a Feature card */}
              <ContactLinkCard
                href="https://github.com/new?labels=enhancement"
                icon={<Lightbulb className="h-6 w-6 text-primary" />}
                title="Request a Feature"
                subtitle="Have an idea? We'd love to hear it"
                external
              />

              {/* Email Support card */}
              <ContactLinkCard
                href={`mailto:${SUPPORT_EMAIL}`}
                icon={<Mail className="h-6 w-6 text-primary" />}
                title="Email Support"
                subtitle={SUPPORT_EMAIL}
                external
              />

              {/* Additional info */}
              <div className="mt-4 p-4 bg-muted/50 border-2 border-border dark:border-white/20">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Response time:</strong>{" "}
                  We typically respond within 24-48 hours during business days.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

export default ContactSection;
