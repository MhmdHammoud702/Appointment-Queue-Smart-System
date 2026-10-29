import * as yup from "yup";

export const bookingSchema = yup.object({
  service: yup.string().required("Choose a service."),
  staff: yup.string().required("Choose a staff member."),
  date: yup.string().required("Choose a date."),
  time: yup.string().required("Choose a time."),
});

export const loginSchema = yup.object({
  email: yup.string().email("Enter a valid email address.").required("Enter your email."),
  password: yup.string().required("Enter your password."),
});

export const registerSchema = yup.object({
  fullName: yup.string().trim().required("Enter your full name."),
  email: yup.string().email("Enter a valid email address.").required("Enter your email."),
  phone: yup.string().trim().required("Enter your phone number."),
  password: yup.string().min(8, "Use at least 8 characters.").required("Create a password."),
});

export const serviceSchema = yup.object({
  name: yup.string().trim().required("Enter a service name."),
  description: yup.string().max(500, "Use 500 characters or fewer."),
  durationMinutes: yup.number().typeError("Enter the visit length in minutes.").positive().integer().required(),
  price: yup.number().typeError("Enter a price.").min(0).required(),
});
